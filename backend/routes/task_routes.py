from flask import Blueprint, request, jsonify, session, send_from_directory, current_app
from models.task_model import Task
from extensions import db
from decorators import login_required
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
from models.user_model import User
from models.team_model import Team
from models.user_team_model import UserTeam
from sqlalchemy import text, or_, and_
from reminder_scheduler import schedule_task_reminders_safe
from pytz import timezone
from models.audit_log_model import AuditLog
from models.notification_outbox_model import NotificationOutbox

task_bp = Blueprint("tasks", __name__, url_prefix="/api")

brazil_tz = timezone("America/Sao_Paulo")
now_brazil = datetime.now(brazil_tz)

# UTILS
from copy import deepcopy
import json

def _truncate(v, maxlen=120):
    if v is None:
        return None
    s = str(v)
    return (s[:maxlen] + "…") if len(s) > maxlen else s

def _coerce_item(x):
    """
    Transforma qualquer item em algo hashável/estável para comparação:
    - dict -> id (se existir) ou JSON ordenado
    - números -> int
    - outros -> string
    """
    if isinstance(x, dict):
        if "id" in x:
            return x["id"]
        return json.dumps(x, sort_keys=True, ensure_ascii=False)
    if isinstance(x, (list, tuple, set)):
        # representa listas de forma estável
        return json.dumps(list(x), sort_keys=True, ensure_ascii=False)
    # números em string que são dígitos -> int
    s = str(x)
    return int(s) if s.isdigit() else s

def _is_manager_for_task(user: User, task: Task) -> bool:
    """
    Regra de quem pode APROVAR/REJEITAR:
    - Admin sempre pode.
    - Gestor da equipe da tarefa pode (task.team_id).
    - Quem atribuiu (assigned_by_user_id) também pode aprovar tarefas pessoais.
    """
    if not user or not user.is_active:
        return False
    if user.is_admin:
        return True
    # gestor de time
    if task.team_id:
        return any(assoc.is_manager and assoc.team_id == task.team_id for assoc in user.teams)
    # tarefa pessoal: quem atribuiu pode aprovar
    if task.assigned_by_user_id and task.assigned_by_user_id == user.id:
        return True
    return False


def _normalize_list(values):
    """
    Normaliza qualquer lista heterogênea para uma lista ordenada de valores hasháveis.
    Remove duplicatas de forma estável.
    """
    if not isinstance(values, list):
        return []
    coerced = [_coerce_item(v) for v in values]
    # usando set para deduplicar (agora hashável), depois ordena por str para estabilidade
    unique_sorted = sorted(set(coerced), key=lambda z: str(z))
    return unique_sorted

def _normalize_attachment_list(anexos):
    """
    Recebe lista de anexos (dicts ou strings) e retorna conjunto/lista estável de nomes.
    """
    names = []
    for a in anexos or []:
        if isinstance(a, dict):
            name = a.get("name") or a.get("id") or ""
        else:
            name = str(a or "")
        if name:
            names.append(name)
    return _normalize_list(names)

def _normalize_user(obj):
    if not isinstance(obj, dict):
        return obj
    base = {}
    if "id" in obj: base["id"] = obj["id"]
    if "name" in obj: base["name"] = obj["name"]
    return base or obj

def normalize_task_snapshot(d: dict) -> dict:
    """
    Reduz o snapshot da task para campos relevantes e comparáveis.
    """
    snap = deepcopy(d or {})

    # Remover ruídos de data/derivados
    snap.pop("created_at", None)
    snap.pop("updated_at", None)

    # Usuários aninhados -> id/name
    if isinstance(snap.get("user"), dict):
        snap["user"] = _normalize_user(snap["user"])
    if isinstance(snap.get("assigned_by_user"), dict):
        snap["assigned_by_user"] = _normalize_user(snap["assigned_by_user"])
    if isinstance(snap.get("assigned_to_user"), dict):
        snap["assigned_to_user"] = _normalize_user(snap["assigned_to_user"])

    # Listas comuns normalizadas (podem vir como ints, strings ou dicts)
    for key in ["tags", "lembretes", "assigned_users", "collaborators"]:
        snap[key] = _normalize_list(snap.get(key) or [])

    # Anexos -> nomes estáveis
    if "anexos" in snap:
        snap["anexos_names"] = _normalize_attachment_list(snap.get("anexos"))
        snap.pop("anexos", None)

    return snap

def diff_snapshots(before: dict, after: dict) -> dict:
    changes = {}

    b = normalize_task_snapshot(before)
    a = normalize_task_snapshot(after)

    keys = set(b.keys()) | set(a.keys())

    for k in sorted(keys):
        bv = b.get(k)
        av = a.get(k)

        # Listas (tags, lembretes, assigned_users, collaborators, anexos_names, ou qualquer lista remanescente)
        if isinstance(bv, list) or isinstance(av, list):
            bnorm = _normalize_list(bv or [])
            anorm = _normalize_list(av or [])
            bset = set(bnorm)
            aset = set(anorm)
            added = sorted(list(aset - bset), key=lambda z: str(z))
            removed = sorted(list(bset - aset), key=lambda z: str(z))
            if added or removed:
                changes[k] = {}
                if added:   changes[k]["added"] = added
                if removed: changes[k]["removed"] = removed
            continue

        # Iguais? segue
        if bv == av:
            continue

        # Diferentes (valor simples)
        changes[k] = {
            "from": _truncate(bv),
            "to": _truncate(av),
        }

    return changes


def format_changes_for_description(changes: dict) -> str:
    """
    Formata mudanças em linhas legíveis.
    """
    if not changes:
        return "Sem alterações relevantes."

    lines = []
    for k, v in changes.items():
        if isinstance(v, dict) and ("added" in v or "removed" in v):
            add = ", ".join(map(str, v.get("added", []))) if v.get("added") else ""
            rem = ", ".join(map(str, v.get("removed", []))) if v.get("removed") else ""
            parts = []
            if add: parts.append(f"+ {add}")
            if rem: parts.append(f"- {rem}")
            lines.append(f"- {k}: " + "; ".join(parts))
        else:
            lines.append(f"- {k}: '{v.get('from')}' → '{v.get('to')}'")
    return "\n".join(lines)

def _collect_team_managers(team_id: int):
    """Retorna lista de usuários gestores ativos da equipe."""
    if not team_id:
        return []
    managers = UserTeam.query.filter_by(team_id=team_id, is_manager=True).all()
    return [m.user for m in managers if m.user and m.user.is_active]

def _collect_assignees(task: Task):
    """Retorna lista de usuários responsáveis (principal + assigned_users) ativos, sem duplicar."""
    ids = set()
    users = []

    if task.user and task.user.is_active:
        ids.add(task.user.id)
        users.append(task.user)

    for uid in (task.assigned_users or []):
        try:
            uid = int(uid)
        except Exception:
            continue
        if uid in ids:
            continue
        u = User.query.get(uid)
        if u and u.is_active:
            ids.add(uid)
            users.append(u)
    return users

def _safe_enqueue_email(to_email: str, subject: str, body: str):
    """Coloca e-mail na outbox; loga e segue se falhar."""
    if not to_email:
        return
    try:
        NotificationOutbox.enqueue_email(
            to_email=to_email,
            subject=subject,
            body=body,
        )
    except Exception:
        current_app.logger.exception("Falha ao enfileirar e-mail (%s)", subject)

def _notify_approval_submitted(task: Task):
    """Notifica os gestores quando uma tarefa é enviada para aprovação."""
    recipients = []
    if task.team_id:
        recipients = _collect_team_managers(task.team_id)
    elif task.assigned_by_user_id:
        ab = User.query.get(task.assigned_by_user_id)
        if ab and ab.is_active:
            recipients = [ab]

    if not recipients:
        return

    for r in recipients:
        _safe_enqueue_email(
            to_email=r.email,
            subject=f"[ZG Planner] Aprovação pendente: {task.title}",
            body=(
                f"Olá {r.username},\n\n"
                f"A tarefa '{task.title}' (ID {task.id}) foi enviada para aprovação.\n"
                f"Acesse o Planner para aprovar ou rejeitar.\n\n"
                f"- Data limite: {task.due_date.isoformat() if task.due_date else '—'}\n"
                f"- Responsável: {task.user.username if task.user else '—'}\n"
            ),
        )

def _notify_approved(task: Task):
    """Notifica os responsáveis quando a tarefa é aprovada (e, pela regra, concluída)."""
    assignees = _collect_assignees(task)
    for u in assignees:
        _safe_enqueue_email(
            to_email=u.email,
            subject=f"[ZG Planner] Tarefa aprovada: {task.title}",
            body=(
                f"Olá {u.username},\n\n"
                f"Sua tarefa '{task.title}' (ID {task.id}) foi aprovada pelo gestor.\n"
                f"O status foi atualizado para CONCLUÍDA.\n\n"
                f"- Aprovada em: {task.approved_at.isoformat() if task.approved_at else '—'}\n"
            ),
        )

def _notify_rejected(task: Task, reason: str | None = None):
    """Notifica os responsáveis quando a tarefa é rejeitada."""
    assignees = _collect_assignees(task)
    for u in assignees:
        _safe_enqueue_email(
            to_email=u.email,
            subject=f"[ZG Planner] Tarefa rejeitada: {task.title}",
            body=(
                f"Olá {u.username},\n\n"
                f"Sua tarefa '{task.title}' (ID {task.id}) foi rejeitada pelo gestor.\n"
                f"{('Motivo: ' + reason + '\\n') if reason else ''}"
                f"Ela retornou para EM ANDAMENTO.\n"
            ),
        )


# ROUTES

@task_bp.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"msg": "Usuário inválido ou inativo"}), 401

    status = request.args.get("status")
    due_before = request.args.get("due_before")
    due_after = request.args.get("due_after")
    search = request.args.get("search")
    assigned_by_user_id = request.args.get("assigned_by_user_id")
    collaborator_id = request.args.get("collaborator_id")
    include_archived = str(request.args.get("include_archived", "false")).lower() in ("1", "true", "yes")
    approval_status = request.args.get("approval_status")  # "pending" | "approved" | "rejected"
    requires_approval_param = request.args.get("requires_approval")  # "true"/"false"
    managed_only = str(request.args.get("managed_only", "false")).lower() in ("1","true","yes")

    # base scope
    if user.is_admin:
        query = Task.query.filter(Task.deleted_at.is_(None))
    else:
        conditions = [
            Task.user_id == user_id,
            Task.assigned_by_user_id == user_id,
            text("tasks.assigned_users::jsonb @> :uid_json").params(uid_json=f'[{user_id}]'),
            text("tasks.collaborators::jsonb @> :uid_json").params(uid_json=f'[{user_id}]')
        ]
        query = Task.query.filter(Task.deleted_at.is_(None)).filter(or_(*conditions))

    # status filter
    VALID_STATUSES = {"pending", "in_progress", "done", "cancelled", "archived"}
    if status:
        if status not in VALID_STATUSES:
            return jsonify({"error": "Status inválido para filtro."}), 400
        query = query.filter(Task.status == status)
    else:
        # <- NOVO: por padrão NÃO trazer arquivadas
        if not include_archived:
            query = query.filter(Task.status != 'archived')

    # dates
    if due_before:
        try:
            due_before_date = datetime.fromisoformat(due_before)
            query = query.filter(Task.due_date != None, Task.due_date <= due_before_date)
        except ValueError:
            return jsonify({"error": "Formato inválido para due_before. Use ISO 8601."}), 400

    if due_after:
        try:
            due_after_date = datetime.fromisoformat(due_after)
            query = query.filter(Task.due_date != None, Task.due_date >= due_after_date)
        except ValueError:
            return jsonify({"error": "Formato inválido para due_after. Use ISO 8601."}), 400

        # --- filtros de aprovação ---
    if approval_status:
        if approval_status not in ("pending", "approved", "rejected"):
            return jsonify({"error": "approval_status inválido."}), 400
        query = query.filter(Task.approval_status == approval_status)

    if requires_approval_param is not None:
        wants = str(requires_approval_param).lower() in ("1", "true", "yes")
        query = query.filter(Task.requires_approval == wants)

    # Se o gestor quer ver apenas tarefas que ele pode aprovar
    if managed_only:
        if user.is_admin:
            # admin vê todas que requerem aprovação e estão pendentes
            query = query.filter(Task.requires_approval == True, Task.approval_status == "pending")
        else:
            # gestor do time OU quem atribuiu (tarefas pessoais)
            team_ids_managed = [ut.team_id for ut in user.teams if ut.is_manager]
            query = query.filter(
                Task.requires_approval == True,
                Task.approval_status == "pending",
                or_(
                    # gestor da equipe da task
                    and_(Task.team_id.isnot(None), Task.team_id.in_(team_ids_managed) if team_ids_managed else False),
                    # tarefas pessoais atribuídas por mim
                    Task.assigned_by_user_id == user_id
                )
            )


    # search / assigned_by / collaborator
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))

    if assigned_by_user_id:
        try:
            assigned_by_user_id = int(assigned_by_user_id)
            query = query.filter(Task.assigned_by_user_id == assigned_by_user_id)
        except ValueError:
            return jsonify({"error": "assigned_by_user_id inválido."}), 400

    if collaborator_id:
        try:
            collaborator_id = int(collaborator_id)
            query = query.filter(
                text("tasks.collaborators::jsonb @> :collab_id_json").params(collab_id_json=f'[{collaborator_id}]')
            )
        except ValueError:
            return jsonify({"error": "collaborator_id inválido."}), 400

    tasks = query.all()

    # enrich anexos
    tasks_data = []
    for task in tasks:
        task_dict = task.to_dict()
        task_dict["assigned_users"] = [int(uid) for uid in task_dict.get("assigned_users", [])]
        task_dict["collaborators"] = [int(uid) for uid in task_dict.get("collaborators", [])]

        if task_dict.get("anexos"):
            anexos_enriched = []
            for anexo in task_dict["anexos"]:
                if isinstance(anexo, str):
                    anexos_enriched.append({
                        "id": anexo,
                        "name": anexo,
                        "url": f"{request.scheme}://{request.host}/uploads/{anexo}",
                        "size": 0,
                        "type": "application/octet-stream"
                    })
                else:
                    a = anexo.copy()
                    if "url" not in a:
                        a["url"] = f"{request.scheme}://{request.host}/uploads/{a.get('name', '')}"
                    anexos_enriched.append(a)
            task_dict["anexos"] = anexos_enriched

        tasks_data.append(task_dict)

    return jsonify(tasks_data)

@task_bp.route("/tasks/counts", methods=["GET"])
@jwt_required()
def get_task_counts():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"msg": "Usuário inválido ou inativo"}), 401

    my_tasks_count = Task.query.filter(
        Task.deleted_at.is_(None),
        Task.status != 'archived', 
        Task.team_id.is_(None),
        or_(
            Task.user_id == user_id,
            text("tasks.assigned_users::jsonb @> :uid_json").params(uid_json=f'[{user_id}]')
        )
    ).count()

    # Tarefas por equipes do usuário
    user_teams = [ut.team_id for ut in user.teams]
    if user_teams:
        team_tasks_count = Task.query.filter(
            Task.deleted_at.is_(None),
            Task.status != 'archived',  
            Task.team_id.in_(user_teams)
        ).count()
    else:
        team_tasks_count = 0

    collaborative_tasks_count = Task.query.filter(
        Task.deleted_at.is_(None),
        Task.status != 'archived',   
        text("tasks.collaborators::jsonb @> :uid_json").params(uid_json=f'[{user_id}]')
    ).count()

    return jsonify({
        "my_tasks": my_tasks_count,
        "team_tasks": team_tasks_count,
        "collaborative_tasks": collaborative_tasks_count
    })

@task_bp.route("/tasks", methods=["POST"])
@jwt_required()
def add_task():
    from datetime import datetime 
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if request.content_type.startswith("multipart/form-data"):
            data = request.form
            files = request.files.getlist("anexos")
        else:
            return jsonify({"error": "Tipo de requisição inválido. Envie como multipart/form-data."}), 400

        if not data.get("title"):
            return jsonify({"error": "O campo título é obrigatório."}), 400

        due_date = None
        if data.get("due_date"):
            try:
                due_date = datetime.fromisoformat(data["due_date"])
                if due_date.tzinfo is not None:
                    due_date = due_date.replace(tzinfo=None)
                if due_date < datetime.utcnow():
                    return jsonify({"error": "A data de vencimento não pode ser no passado."}), 400
            except ValueError:
                return jsonify({"error": "Formato inválido para due_date. Use ISO 8601."}), 400

        # Verifica se a task é de equipe
        team_id = data.get("team_id")
        if team_id:
            try:
                team_id = int(team_id)
            except ValueError:
                return jsonify({"error": "team_id inválido"}), 400

            team = Team.query.get(team_id)
            if not team:
                return jsonify({"error": "Time não encontrado."}), 404

            is_manager = user.is_admin or any(assoc.is_manager and assoc.team_id == team.id for assoc in user.teams)
            if not is_manager:
                return jsonify({"error": "Apenas gestores podem criar tarefas para a equipe."}), 403
        else:
            team_id = None

        # Processar usuários atribuídos
        assigned_to_user_ids = data.get("assigned_to_user_ids")
        if assigned_to_user_ids:
            try:
                if assigned_to_user_ids == "all":
                    if team_id:
                        team_members = UserTeam.query.filter_by(team_id=team_id).all()
                        assigned_to_user_ids = [member.user_id for member in team_members]
                    else:
                        return jsonify({"error": "Não é possível atribuir para 'todos' sem equipe."}), 400
                else:
                    assigned_to_user_ids = json.loads(assigned_to_user_ids)
                    if not isinstance(assigned_to_user_ids, list):
                        raise ValueError("assigned_to_user_ids deve ser uma lista de IDs ou 'all'.")

                # Valida atribuição
                if team_id:
                    for assigned_user_id in assigned_to_user_ids:
                        assigned_user = User.query.get(assigned_user_id)
                        if not assigned_user:
                            return jsonify({"error": f"Usuário {assigned_user_id} não encontrado."}), 404
                        is_team_member = any(assoc.team_id == team_id for assoc in assigned_user.teams)
                        if not is_team_member:
                            return jsonify({"error": f"O usuário {assigned_user.username} deve ser membro da equipe."}), 400
                else:
                    if len(assigned_to_user_ids) > 1 or (len(assigned_to_user_ids) == 1 and assigned_to_user_ids[0] != user_id):
                        return jsonify({"error": "Você só pode atribuir tarefas pessoais para si mesmo."}), 403
            except (json.JSONDecodeError, ValueError) as e:
                return jsonify({"error": f"Formato inválido para assigned_to_user_ids: {str(e)}"}), 400

        # Definir usuário principal da tarefa
        if assigned_to_user_ids:
            task_user_id = assigned_to_user_ids[0]
        else:
            task_user_id = user_id  # garante sempre um responsável

        assigned_by_user_id = user_id if task_user_id != user_id else None
        assigned_users = assigned_to_user_ids if assigned_to_user_ids else [task_user_id]

        # Processar colaboradores
        collaborators = []
        if data.get("collaborator_ids"):
            try:
                collaborator_ids_data = data.get("collaborator_ids")
                if collaborator_ids_data == "all":
                    if team_id:
                        team_members = UserTeam.query.filter_by(team_id=team_id).all()
                        collaborators = [m.user_id for m in team_members if m.user_id != task_user_id]
                    else:
                        return jsonify({"error": "Não é possível adicionar 'todos' como colaboradores sem equipe."}), 400
                else:
                    collaborators = json.loads(collaborator_ids_data)
                    if not isinstance(collaborators, list):
                        raise ValueError("collaborator_ids deve ser lista ou 'all'.")
                for collab_id in collaborators:
                    if not User.query.get(collab_id):
                        return jsonify({"error": f"Colaborador {collab_id} não encontrado."}), 404
            except (json.JSONDecodeError, ValueError):
                return jsonify({"error": "Formato inválido para collaborator_ids."}), 400

        # Processar anexos
        anexos_data = []
        for file in files:
            if file.filename:
                filename = secure_filename(file.filename)
                filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
                file.save(filepath)
                anexos_data.append({
                    "id": filename,
                    "name": filename,
                    "size": os.path.getsize(filepath),
                    "type": file.content_type or "application/octet-stream",
                    "url": f"{request.scheme}://{request.host}/uploads/{filename}"
                })

        # Lembretes e tags
        try:
            lembretes = json.loads(data.get("lembretes", "[]"))
        except Exception:
            lembretes = []

        try:
            tags = json.loads(data.get("tags", "[]"))
        except Exception:
            tags = []

        # Criar a task
        new_task = Task(
            title=data["title"],
            description=data.get("description"),
            status=data.get("status", "pending"),
            due_date=due_date,
            user_id=task_user_id,
            assigned_by_user_id=assigned_by_user_id,
            collaborators=collaborators,
            assigned_users=assigned_users,
            team_id=team_id,
            prioridade=data.get("prioridade"),
            categoria=data.get("categoria"),
            status_inicial=data.get("status_inicial"),
            tempo_estimado=data.get("tempo_estimado"),
            tempo_unidade=data.get("tempo_unidade"),
            relacionado_a=data.get("relacionado_a"),
            lembretes=lembretes,
            tags=tags,
            anexos=anexos_data,
            requires_approval=str(data.get("requires_approval", "false")).lower() in ("1", "true", "yes")
        )

        db.session.add(new_task)
        db.session.commit()

        # Registrar auditoria
        AuditLog.log_action(
            user_id=user_id,
            action="CREATE",
            resource_type="Task",
            resource_id=new_task.id,
            description=f"Tarefa criada: {new_task.title}. Atribuídos: {assigned_users}, Colaboradores: {collaborators}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent")
        )

        # Agendar lembretes se configurados
        if new_task.lembretes and new_task.due_date:
            schedule_task_reminders_safe(new_task)

        return jsonify(new_task.to_dict()), 201

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": "Erro interno no servidor", "message": str(e)}), 500



@task_bp.route("/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def get_task(task_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if task is None:
        return jsonify({"error": "Tarefa não encontrada"}), 404
    
    if task.is_deleted:
        return jsonify({"error": "Tarefa está na lixeira"}), 410

    # Usar o método can_be_viewed_by do modelo
    if not task.can_be_viewed_by(user):
        return jsonify({"error": "Acesso negado"}), 403

    task_dict = task.to_dict()
    
    # Enriquecer anexos com URLs completas
    if task_dict.get("anexos"):
        anexos_enriched = []
        for anexo in task_dict["anexos"]:
            if isinstance(anexo, str):
                anexo_obj = {
                    "id": anexo,
                    "name": anexo,
                    "url": f"{request.scheme}://{request.host}/uploads/{anexo}",
                    "size": 0,
                    "type": "application/octet-stream"
                }
            else:
                anexo_obj = anexo.copy()
                if "url" not in anexo_obj:
                    anexo_obj["url"] = f"{request.scheme}://{request.host}/uploads/{anexo_obj.get('name', '')}"
            
            anexos_enriched.append(anexo_obj)
        
        task_dict["anexos"] = anexos_enriched

    return jsonify(task_dict)

@task_bp.route("/tasks/<int:task_id>", methods=["PUT"])
@jwt_required()
def update_task(task_id):
    """
    Atualiza tarefa mantendo coerência entre status, completed_at e archived_at.
    Observação: quaisquer valores enviados de completed_at/archived_at no payload são ignorados.
    """
    from models.audit_log_model import AuditLog
    from sqlalchemy import desc
    from werkzeug.utils import secure_filename
    import os

    # (debug) últimos logs
    last = AuditLog.query.order_by(desc(AuditLog.id)).limit(5).all()
    try:
        print([(l.id, l.action, l.resource_type, l.resource_id, l.created_at) for l in last])
    except Exception:
        pass

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404

    before_state = task.to_dict()

    can_reassign = bool(user and (user.is_admin or task.can_be_assigned_by(user)))
    can_basic_edit = bool(user and (user.is_admin or task.user_id == user.id or task.assigned_by_user_id == user.id))
    if not (can_basic_edit or can_reassign):
        return jsonify({"error": "Acesso negado"}), 403

    # Payload
    if request.is_json:
        data = request.get_json()
        files = []
    elif request.content_type and request.content_type.startswith("multipart/form-data"):
        data = request.form
        files = request.files.getlist("new_files")
    else:
        return jsonify({"error": "Content-Type inválido. Use application/json ou multipart/form-data."}), 400

    # due_date
    if data.get("due_date"):
        try:
            due_date = datetime.fromisoformat(data["due_date"])
            if due_date.tzinfo is not None:
                due_date = due_date.replace(tzinfo=None)
            if due_date < datetime.utcnow():
                return jsonify({"error": "A data de vencimento não pode ser no passado."}), 400
            task.due_date = due_date
        except ValueError:
            return jsonify({"error": "Formato inválido para due_date. Use ISO 8601."}), 400

    # Campos básicos
    if data.get("title") is not None:
        task.title = data["title"]
    if data.get("description") is not None:
        task.description = data["description"]
    if data.get("prioridade") is not None:
        task.prioridade = data["prioridade"]
    if data.get("categoria") is not None:
        task.categoria = data["categoria"]
    if data.get("status_inicial") is not None:
        task.status_inicial = data["status_inicial"]
    if data.get("tempo_estimado") is not None:
        task.tempo_estimado = data["tempo_estimado"]
    if data.get("tempo_unidade") is not None:
        task.tempo_unidade = data["tempo_unidade"]
    if data.get("relacionado_a") is not None:
        task.relacionado_a = data["relacionado_a"]
    # Aprovação - pode ligar/desligar (cuidado com implicações)
    if data.get("requires_approval") is not None:
        ra_flag = str(data.get("requires_approval")).lower() in ("1","true","yes")
        task.requires_approval = ra_flag
        # Se passou a exigir aprovação e já está 'done', força pendência até aprovar (opcional)
        if ra_flag and task.status == 'done' and not task.is_approved():
            task.status = 'in_progress'
            task.completed_at = None
            task.approval_status = 'pending'
            task.approved_by_user_id = None
            task.approved_at = None
    # --- Status & timestamps coerentes ---
    ALLOWED_STATUSES = {"pending", "in_progress", "done", "cancelled", "archived"}
    prev_status = task.status
    if "status" in data:
        new_status = str(data["status"]).strip()

        if new_status not in ALLOWED_STATUSES:
            return jsonify({"error": "Status inválido."}), 400

        now = datetime.utcnow()

        # Bloqueia conclusão se faltar aprovação
        if new_status == "done":
            try:
                task.mark_done()  # aplica regra de aprovação internamente
            except ValueError as ve:
                return jsonify({"error": str(ve)}), 409
        else:
            # transições normais
            task.status = new_status

            # saiu de done?
            if prev_status == "done" and new_status != "done":
                task.completed_at = None
                if new_status != "archived":
                    task.archived_at = None
                    task.archived_by_user_id = None

            # indo para arquivado?
            if new_status == "archived" and prev_status != "archived":
                task.archived_at = now
                task.archived_by_user_id = user_id
                if not task.completed_at:
                    task.completed_at = now
            elif prev_status == "archived" and new_status != "archived":
                task.archived_at = None
                task.archived_by_user_id = None


    # Reatribuição (só se pode e se mudou)
    def _reassign_to(new_user_id: int):
        nonlocal task, user_id
        if new_user_id != task.user_id:
            task.user_id = new_user_id
            task.assigned_by_user_id = user_id

    if can_reassign:
        if data.get("assigned_to_user_ids") is not None:
            try:
                ids = json.loads(data["assigned_to_user_ids"])
                if isinstance(ids, list) and len(ids) > 0:
                    _reassign_to(int(ids[0]))
            except (json.JSONDecodeError, ValueError):
                return jsonify({"error": "assigned_to_user_ids inválido"}), 400
        elif data.get("assigned_to_user_id") is not None:
            try:
                single_id = int(data["assigned_to_user_id"])
                _reassign_to(single_id)
            except ValueError:
                return jsonify({"error": "assigned_to_user_id inválido"}), 400

    # Colaboradores (só se pode reatribuir)
    if data.get("collaborator_ids") is not None and can_reassign:
        try:
            collaborators = json.loads(data["collaborator_ids"])
            if isinstance(collaborators, list):
                task.collaborators = collaborators
        except (json.JSONDecodeError, ValueError):
            return jsonify({"error": "Formato inválido para collaborator_ids."}), 400

    # Anexos (multipart)
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        existing_files_data = data.get("existing_files")
        if existing_files_data:
            try:
                existing_files = json.loads(existing_files_data)
                task.anexos = existing_files
            except (json.JSONDecodeError, ValueError):
                pass

        files_to_remove_data = data.get("files_to_remove")
        if files_to_remove_data:
            try:
                files_to_remove = json.loads(files_to_remove_data)
                for filename in files_to_remove:
                    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
                    if os.path.exists(filepath):
                        try:
                            os.remove(filepath)
                        except OSError:
                            pass
            except (json.JSONDecodeError, ValueError):
                pass

        if files:
            if task.anexos is None:
                task.anexos = []
            for file in files:
                if file.filename:
                    filename = secure_filename(file.filename)
                    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
                    file.save(filepath)
                    task.anexos.append({
                        "id": filename,
                        "name": filename,
                        "size": os.path.getsize(filepath),
                        "type": file.content_type or "application/octet-stream",
                        "url": f"{request.scheme}://{request.host}/uploads/{filename}"
                    })

    # Tags/lembretes
    try:
        lembretes = json.loads(data.get("lembretes", "[]"))
        if isinstance(lembretes, list):
            task.lembretes = lembretes
    except Exception:
        pass
    try:
        tags = json.loads(data.get("tags", "[]"))
        if isinstance(tags, list):
            task.tags = tags
    except Exception:
        pass

    # Salvar
    task.updated_at = datetime.utcnow()
    db.session.commit()

    # Auditoria (diff limpo)
    try:
        after_state = task.to_dict()
        changes = diff_snapshots(before_state, after_state)
        desc = f"Mudanças:\n{format_changes_for_description(changes)}"

        created = None
        try:
            created = AuditLog.log_action(
                user_id=user_id,
                action="UPDATE",
                resource_type="task",
                resource_id=task.id,
                description=desc,
                ip_address=request.remote_addr,
                user_agent=request.headers.get("User-Agent"),
                before=before_state,
                after=after_state,
                changes=changes,
            )
        except TypeError:
            created = AuditLog.log_action(
                user_id=user_id,
                action="UPDATE",
                resource_type="task",
                resource_id=task.id,
                description=desc,
                ip_address=request.remote_addr,
                user_agent=request.headers.get("User-Agent"),
            )
        try:
            current_app.logger.info(f"[AUDIT] UPDATE task={task.id} audit_id={getattr(created, 'id', None)}")
        except Exception:
            pass

    except Exception:
        current_app.logger.exception("Falha ao registrar auditoria (UPDATE)")

    # Reagendar lembretes (apenas se ainda houver due_date)
    if task.lembretes and task.due_date:
        schedule_task_reminders_safe(task)

    return jsonify(task.to_dict())


@task_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404

    can_delete = (
        user.is_admin or 
        task.user_id == user_id or 
        (task.assigned_by_user_id == user_id) or 
        (task.user_id == user_id and task.assigned_by_user_id is None)
    )
    if not can_delete:
        is_collaborator = user_id in (task.collaborators or [])
        if is_collaborator:
            return jsonify({"error": "Colaboradores não podem excluir tarefas. Apenas o criador, responsável ou gestor podem fazer isso."}), 403
        return jsonify({"error": "Você não tem permissão para excluir esta tarefa."}), 403

    # Se já está na lixeira, evita marcar de novo
    if task.is_deleted:
        return jsonify({"message": "Tarefa já está na lixeira"}), 200

    # Soft delete: não removemos anexos do disco no soft delete
    task.soft_delete(user_id=user_id)
    task.updated_at = datetime.utcnow()
    db.session.commit()

    # Auditoria
    AuditLog.log_action(
        user_id=user_id,
        action="DELETE",  # mantém ação DELETE como registro semântico
        resource_type="Task",
        resource_id=task.id,
        description=f"Tarefa movida para lixeira: {task.title}.",
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent")
    )

    return jsonify({"message": "Tarefa movida para a lixeira com sucesso", "id": task.id}), 200

@task_bp.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)


# Nova rota para obter membros de uma equipe (para o componente de atribuição)
@task_bp.route("/teams/<int:team_id>/members", methods=["GET"])
@jwt_required()
def get_team_members(team_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    team = Team.query.get(team_id)
    if not team:
        return jsonify({"error": "Equipe não encontrada"}), 404
    
    # Verificar se o usuário tem acesso à equipe
    user_team_ids = [assoc.team_id for assoc in user.teams]
    if not user.is_admin and team_id not in user_team_ids:
        return jsonify({"error": "Acesso negado"}), 403
    
    members = []
    for member_assoc in team.members:
        if not member_assoc.user:
            continue  # pula registros sem usuário
        if member_assoc.user.id != user_id:
            members.append({
                "id": member_assoc.user.id,
                "username": member_assoc.user.username,
                "email": member_assoc.user.email,
                "is_manager": member_assoc.is_manager
            })
    
    return jsonify(members)


# Nova rota para obter usuários disponíveis para colaboração
@task_bp.route("/users/available-collaborators", methods=["GET"])
@jwt_required()
def get_available_collaborators():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Buscar todos os usuários ativos (exceto o próprio usuário)
    users = User.query.filter(User.is_active == True, User.id != user_id).all()
    
    collaborators = []
    for u in users:
        collaborators.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "teams": [{"id": assoc.team.id, "name": assoc.team.name} for assoc in u.teams]
        })
    
    return jsonify(collaborators)

@task_bp.route("/tasks/reports", methods=["GET"])
@jwt_required()
def get_task_reports():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"msg": "Usuário inválido ou inativo"}), 401

    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")
    status = request.args.get("status")
    priority = request.args.get("priority")
    category = request.args.get("category")
    active_only = str(request.args.get("active_only", "true")).lower() in ("1","true","yes")

    query = Task.query.filter(
        Task.deleted_at.is_(None),
        or_(
            Task.user_id == user_id,
            Task.assigned_by_user_id == user_id,
            text("tasks.assigned_users::jsonb @> :user_id_json").params(user_id_json=f'[{user_id}]'),
            text("tasks.collaborators::jsonb @> :user_id_json").params(user_id_json=f'[{user_id}]')
        )
    )

    if active_only:
        query = query.filter(Task.status != 'archived')

    if start_date_str:
        try:
            start_date = datetime.fromisoformat(start_date_str)
            query = query.filter(Task.created_at >= start_date)
        except ValueError:
            return jsonify({"error": "Formato inválido para start_date. Use ISO 8601."}), 400

    if end_date_str:
        try:
            end_date = datetime.fromisoformat(end_date_str)
            query = query.filter(Task.created_at <= end_date)
        except ValueError:
            return jsonify({"error": "Formato inválido para end_date. Use ISO 8601."}), 400

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.prioridade == priority)
    if category:
        query = query.filter(Task.categoria == category)

    tasks = query.all()

    report_data = {
        "total_tasks": len(tasks),
        "tasks_by_status": {},
        "tasks_by_priority": {},
        "tasks_by_category": {},
        "tasks_completed_on_time": 0,
        "tasks_completed_late": 0,
        "average_completion_time": "N/A",
        "overdue_tasks": 0,
        "upcoming_tasks": 0,
        "detailed_tasks": []
    }

    completed_tasks_times = []

    for task in tasks:
        task_dict = task.to_dict()
        report_data["detailed_tasks"].append(task_dict)

        # Contagem por status
        report_data["tasks_by_status"][task.status] = report_data["tasks_by_status"].get(task.status, 0) + 1

        # Contagem por prioridade
        if task.prioridade:
            report_data["tasks_by_priority"][task.prioridade] = report_data["tasks_by_priority"].get(task.prioridade, 0) + 1

        # Contagem por categoria
        if task.categoria:
            report_data["tasks_by_category"][task.categoria] = report_data["tasks_by_category"].get(task.categoria, 0) + 1

        # Normalizar due_date para o fuso do Brasil (se existir)
        due_date_local = None
        if task.due_date:
            try:
                # assumindo timestamps UTC no banco
                due_date_local = task.due_date.replace(tzinfo=timezone("UTC")).astimezone(brazil_tz)
            except Exception:
                # se já for naive/local, usa direto
                due_date_local = task.due_date

        # Critério único de "concluída" válida
        is_completed_valid = (
            task.status == 'done' and
            (not getattr(task, "requires_approval", False) or getattr(task, "approval_status", None) == 'approved')
        )

        # Concluídas no prazo/atrasadas
        if is_completed_valid and task.due_date:
            if task.updated_at and task.updated_at <= task.due_date:
                report_data["tasks_completed_on_time"] += 1
            else:
                report_data["tasks_completed_late"] += 1

            if task.created_at and task.updated_at:
                time_taken = (task.updated_at - task.created_at).total_seconds()
                completed_tasks_times.append(time_taken)

        # Overdue / Upcoming (apenas uma vez, sem contar duas vezes)
        if due_date_local and task.status != 'done':
            if due_date_local < now_brazil:
                report_data["overdue_tasks"] += 1
            elif due_date_local > now_brazil:
                report_data["upcoming_tasks"] += 1

    # Tempo médio de conclusão
    if completed_tasks_times:
        avg_seconds = sum(completed_tasks_times) / len(completed_tasks_times)
        days = int(avg_seconds // (24 * 3600))
        hours = int((avg_seconds % (24 * 3600)) // 3600)
        minutes = int((avg_seconds % 3600) // 60)
        report_data["average_completion_time"] = f"{days}d {hours}h {minutes}m"

    return jsonify(report_data)

@task_bp.route("/tasks/<int:task_id>/restore", methods=["POST"])
@jwt_required()
def restore_task(task_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404

    # Permissões: admin, responsável, quem atribuiu
    can_restore = (
        user.is_admin or 
        task.user_id == user_id or 
        (task.assigned_by_user_id == user_id)
    )
    if not can_restore:
        return jsonify({"error": "Você não tem permissão para restaurar esta tarefa."}), 403

    if not task.is_deleted:
        return jsonify({"message": "Tarefa não está na lixeira"}), 200

    task.restore()
    task.updated_at = datetime.utcnow()
    db.session.commit()

    # Auditoria
    AuditLog.log_action(
        user_id=user_id,
        action="RESTORE",
        resource_type="Task",
        resource_id=task.id,
        description=f"Tarefa restaurada da lixeira: {task.title}.",
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent")
    )

    return jsonify({"message": "Tarefa restaurada com sucesso", "id": task.id}), 200

@task_bp.route("/tasks/trash", methods=["GET"])
@jwt_required()
def list_trash():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    # escopo de visibilidade igual ao GET /tasks, só que filtrando deleted_at != NULL
    if user.is_admin:
        query = Task.query.filter(Task.deleted_at.isnot(None))
    else:
        conditions = [
            Task.user_id == user_id,
            Task.assigned_by_user_id == user_id,
            text("tasks.assigned_users::jsonb @> :uid_json").params(uid_json=f'[{user_id}]'),
            text("tasks.collaborators::jsonb @> :uid_json").params(uid_json=f'[{user_id}]')
        ]
        query = Task.query.filter(Task.deleted_at.isnot(None)).filter(or_(*conditions))

    search = request.args.get("search")
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))

    tasks = query.order_by(Task.deleted_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks]), 200

@task_bp.route("/tasks/<int:task_id>/unarchive", methods=["POST"])
@jwt_required()
def unarchive_task(task_id):
    user_id = int(get_jwt_identity())
    from models.user_model import User
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404
    if not task.can_be_viewed_by(user):
        return jsonify({"error": "Acesso negado"}), 403

    task.unarchive(new_status="pending")
    task.updated_at = datetime.utcnow()
    db.session.commit()

    from models.audit_log_model import AuditLog
    AuditLog.log_action(
        user_id=user_id,
        action="UNARCHIVE",
        resource_type="Task",
        resource_id=task.id,
        description=f"Tarefa desarquivada: {task.title}.",
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent")
    )

    return jsonify(task.to_dict()), 200

@task_bp.route("/tasks/archived", methods=["GET"])
@jwt_required()
def list_archived_tasks_paginated():
    """
    Retorna tarefas arquivadas com paginação, sem quebrar o /tasks atual.
    Usar quando a coluna 'Arquivadas' for expandida.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({"msg": "Usuário inválido ou inativo"}), 401

    # paginação
    try:
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 50))
        page = 1 if page < 1 else page
        page_size = max(1, min(page_size, 200))  # limite superior pra não pesar
    except ValueError:
        return jsonify({"error": "Parâmetros de paginação inválidos."}), 400

    search = request.args.get("search")

    # escopo de visibilidade (mesmo critério do /tasks)
    if user.is_admin:
        query = Task.query.filter(
            Task.deleted_at.is_(None),
            Task.status == 'archived'
        )
    else:
        conditions = [
            Task.user_id == user_id,
            Task.assigned_by_user_id == user_id,
            text("tasks.assigned_users::jsonb @> :uid_json").params(uid_json=f'[{user_id}]'),
            text("tasks.collaborators::jsonb @> :uid_json").params(uid_json=f'[{user_id}]')
        ]
        query = Task.query.filter(
            Task.deleted_at.is_(None),
            Task.status == 'archived'
        ).filter(or_(*conditions))

    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))

    # total pra paginação
    total = query.count()

    # ordene por mais recente arquivada primeiro (ou o que fizer sentido pra você)
    items = (query
             .order_by(Task.archived_at.desc().nullslast(), Task.updated_at.desc())
             .offset((page - 1) * page_size)
             .limit(page_size)
             .all())

    # enriquecer anexos (igual ao /tasks)
    payload = []
    for task in items:
        td = task.to_dict()
        if td.get("anexos"):
            anexos_enriched = []
            for anexo in td["anexos"]:
                if isinstance(anexo, str):
                    anexos_enriched.append({
                        "id": anexo,
                        "name": anexo,
                        "url": f"{request.scheme}://{request.host}/uploads/{anexo}",
                        "size": 0,
                        "type": "application/octet-stream"
                    })
                else:
                    a = anexo.copy()
                    if "url" not in a:
                        a["url"] = f"{request.scheme}://{request.host}/uploads/{a.get('name','')}"
                    anexos_enriched.append(a)
            td["anexos"] = anexos_enriched
        payload.append(td)

    return jsonify({
        "items": payload,
        "page": page,
        "page_size": page_size,
        "total": total
    }), 200

@task_bp.route("/tasks/<int:task_id>/submit_for_approval", methods=["POST"])
@jwt_required()
def submit_task_for_approval(task_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404
    if task.is_deleted:
        return jsonify({"error": "Tarefa está na lixeira"}), 410
    if not task.can_be_viewed_by(user):
        return jsonify({"error": "Acesso negado"}), 403

    if not task.requires_manager_approval():
        return jsonify({"message": "Esta tarefa não requer aprovação."}), 200

    task.submit_for_approval()
    task.updated_at = datetime.utcnow()
    db.session.commit()

        # Notifica gestor(es)
    try:
        recipients = []
        if task.team_id:
            # todos gestores do time
            managers = UserTeam.query.filter_by(team_id=task.team_id, is_manager=True).all()
            recipients = [m.user for m in managers if m.user and m.user.is_active]
        elif task.assigned_by_user_id:
            # tarefa pessoal: quem atribuiu
            ab = User.query.get(task.assigned_by_user_id)
            if ab and ab.is_active:
                recipients = [ab]

        for r in recipients:
            NotificationOutbox.enqueue_email(
                to_email=r.email,
                subject=f"[ZG Planner] Aprovação pendente: {task.title}",
                body=f"Olá {r.username},\n\nA tarefa '{task.title}' foi enviada para aprovação.\n\nAbra o Planner e aprove/rejeite.\nID: {task.id}"
            )
    except Exception:
        current_app.logger.exception("Falha ao enfileirar e-mail de aprovação pendente")

    AuditLog.log_action(
        user_id=user_id,
        action="SUBMIT_FOR_APPROVAL",
        resource_type="Task",
        resource_id=task.id,
        description=f"Tarefa enviada para aprovação: {task.title}.",
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent")
    )

    return jsonify(task.to_dict()), 200

@task_bp.route("/tasks/<int:task_id>/approve", methods=["POST"])
@jwt_required()
def approve_task(task_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404
    if task.is_deleted:
        return jsonify({"error": "Tarefa está na lixeira"}), 410
    if not _is_manager_for_task(user, task):
        return jsonify({"error": "Apenas gestores/admin podem aprovar."}), 403

    if not task.requires_manager_approval():
        return jsonify({"message": "Esta tarefa não requer aprovação."}), 200

    # Se já aprovado, retorna idempotente
    if task.is_approved():
        return jsonify({"message": "Tarefa já está aprovada.", "task": task.to_dict()}), 200

    task.set_approved(approver_user_id=user_id)
    try:
        task.mark_done()  # já seta status=done + completed_at
    except Exception:
        # em teoria não lança, mas deixo safe
        pass
    task.updated_at = datetime.utcnow()
    db.session.commit()

        # Notifica responsável (owner principal)
    try:
        owner = task.user
        if owner and owner.is_active:
            status_txt = "aprovada"  # na reject trocar por "rejeitada"
            NotificationOutbox.enqueue_email(
                to_email=owner.email,
                subject=f"[ZG Planner] Sua tarefa foi {status_txt}: {task.title}",
                body=f"Olá {owner.username},\n\nA tarefa '{task.title}' foi {status_txt} pelo gestor.\nID: {task.id}"
            )
    except Exception:
        current_app.logger.exception("Falha ao enfileirar e-mail de decisão de aprovação")

    AuditLog.log_action(
        user_id=user_id,
        action="APPROVE",
        resource_type="Task",
        resource_id=task.id,
        description=f"Tarefa aprovada: {task.title}.",
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent")
    )

    return jsonify(task.to_dict()), 200

@task_bp.route("/tasks/<int:task_id>/reject", methods=["POST"])
@jwt_required()
def reject_task(task_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404
    if task.is_deleted:
        return jsonify({"error": "Tarefa está na lixeira"}), 410
    if not _is_manager_for_task(user, task):
        return jsonify({"error": "Apenas gestores/admin podem rejeitar."}), 403

    if not task.requires_manager_approval():
        return jsonify({"message": "Esta tarefa não requer aprovação."}), 200

    task.set_rejected(approver_user_id=user_id)
    # Se estava em done por alguma inconsistência, volta para in_progress
    if task.status == 'done':
        task.status = 'in_progress'
        task.completed_at = None

    task.updated_at = datetime.utcnow()
    db.session.commit()

        # Notifica responsável (owner principal)
    try:
        owner = task.user
        if owner and owner.is_active:
            status_txt = "aprovada"  # na reject trocar por "rejeitada"
            NotificationOutbox.enqueue_email(
                to_email=owner.email,
                subject=f"[ZG Planner] Sua tarefa foi {status_txt}: {task.title}",
                body=f"Olá {owner.username},\n\nA tarefa '{task.title}' foi {status_txt} pelo gestor.\nID: {task.id}"
            )
    except Exception:
        current_app.logger.exception("Falha ao enfileirar e-mail de decisão de aprovação")

    AuditLog.log_action(
        user_id=user_id,
        action="REJECT",
        resource_type="Task",
        resource_id=task.id,
        description=f"Tarefa rejeitada: {task.title}.",
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent")
    )

    return jsonify(task.to_dict()), 200
