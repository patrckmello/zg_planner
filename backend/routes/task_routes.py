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

task_bp = Blueprint("tasks", __name__, url_prefix="/api")

brazil_tz = timezone("America/Sao_Paulo")
now_brazil = datetime.now(brazil_tz)

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
    collaborator_id = request.args.get("collaborator_id")  # Para filtro de colaborador

    # Query base
    if user.is_admin:
        query = Task.query
    else:
        # Filtros para usuários normais
        conditions = [
            Task.user_id == user_id,  # tarefas próprias
            Task.assigned_by_user_id == user_id,  # tarefas que ele criou
            text("tasks.assigned_users::jsonb @> :user_id_json").params(user_id_json=f'[{user_id}]'),
            text("tasks.collaborators::jsonb @> :user_id_json").params(user_id_json=f'[{user_id}]')
        ]
        query = Task.query.filter(or_(*conditions))

    # Filtro de status
    if status:
        if status not in ["pending", "done", "in_progress", "cancelled"]:
            return jsonify({"error": "Status inválido para filtro."}), 400
        query = query.filter(Task.status == status)

    # Filtro de datas
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

    # Filtro de busca
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))

    # Filtro de quem atribuiu
    if assigned_by_user_id:
        try:
            assigned_by_user_id = int(assigned_by_user_id)
            query = query.filter(Task.assigned_by_user_id == assigned_by_user_id)
        except ValueError:
            return jsonify({"error": "assigned_by_user_id inválido."}), 400

    # Filtro de colaborador específico
    if collaborator_id:
        try:
            collaborator_id = int(collaborator_id)
            query = query.filter(text("tasks.collaborators::jsonb @> :collab_id_json").params(collab_id_json=f'[{collaborator_id}]'))
        except ValueError:
            return jsonify({"error": "collaborator_id inválido."}), 400

    tasks = query.all()

    # Enriquecer dados dos anexos com URLs completas
    tasks_data = []
    for task in tasks:
        task_dict = task.to_dict()

        # Garantir que assigned_users e collaborators sejam sempre números
        task_dict["assigned_users"] = [int(uid) for uid in task_dict.get("assigned_users", [])]
        task_dict["collaborators"] = [int(uid) for uid in task_dict.get("collaborators", [])]

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

        tasks_data.append(task_dict)

    return jsonify(tasks_data)

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
            anexos=anexos_data
        )

        db.session.add(new_task)
        db.session.commit()

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
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404

    # Garantir que collaborators é uma lista de IDs
    collaborators_ids = task.collaborators or []

    # Permissão de edição: admin, gestor ou colaborador da task
    if not (user.is_admin or task.can_be_assigned_by(user) or user.id in collaborators_ids):
        return jsonify({"error": "Acesso negado"}), 403

    # Diferenciar JSON de multipart/form-data
    if request.is_json:
        data = request.get_json()
        files = []
    elif request.content_type and request.content_type.startswith("multipart/form-data"):
        data = request.form
        files = request.files.getlist("new_files")
    else:
        return jsonify({"error": "Content-Type inválido. Use application/json ou multipart/form-data."}), 400

    # Validação de due_date
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

    # Atualizar campos básicos
    if data.get("title"):
        task.title = data["title"]
    if data.get("description") is not None:
        task.description = data["description"]
    if data.get("status"):
        task.status = data["status"]
    if data.get("prioridade"):
        task.prioridade = data["prioridade"]
    if data.get("categoria"):
        task.categoria = data["categoria"]
    if data.get("status_inicial"):
        task.status_inicial = data["status_inicial"]
    if data.get("tempo_estimado"):
        task.tempo_estimado = data["tempo_estimado"]
    if data.get("tempo_unidade"):
        task.tempo_unidade = data["tempo_unidade"]
    if data.get("relacionado_a") is not None:
        task.relacionado_a = data["relacionado_a"]

    # Atualizar colaboradores (apenas admin/gestor)
    if data.get("collaborator_ids") is not None and (user.is_admin or task.can_be_assigned_by(user)):
        try:
            collaborators = json.loads(data["collaborator_ids"])
            if isinstance(collaborators, list):
                task.collaborators = collaborators
        except (json.JSONDecodeError, ValueError):
            return jsonify({"error": "Formato inválido para collaborator_ids."}), 400

    # Atualizar atribuição (apenas admin/gestor)
    if data.get("assigned_to_user_ids") is not None and (user.is_admin or task.can_be_assigned_by(user)):
        try:
            assigned_to_user_ids = json.loads(data["assigned_to_user_ids"])
            if isinstance(assigned_to_user_ids, list) and len(assigned_to_user_ids) > 0:
                task.user_id = assigned_to_user_ids[0]
                task.assigned_by_user_id = user_id
        except (json.JSONDecodeError, ValueError):
            return jsonify({"error": "assigned_to_user_ids inválido"}), 400
    elif data.get("assigned_to_user_id") is not None and (user.is_admin or task.can_be_assigned_by(user)):
        try:
            assigned_to_user_id = int(data["assigned_to_user_id"])
            if assigned_to_user_id != task.user_id:
                task.user_id = assigned_to_user_id
                task.assigned_by_user_id = user_id
        except ValueError:
            return jsonify({"error": "assigned_to_user_id inválido"}), 400

    # Processar anexos (multipart/form-data)
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        # Arquivos existentes
        existing_files_data = data.get("existing_files")
        if existing_files_data:
            try:
                existing_files = json.loads(existing_files_data)
                task.anexos = existing_files
            except (json.JSONDecodeError, ValueError):
                pass

        # Arquivos a remover
        files_to_remove_data = data.get("files_to_remove")
        if files_to_remove_data:
            try:
                files_to_remove = json.loads(files_to_remove_data)
                for filename in files_to_remove:
                    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
                    if os.path.exists(filepath):
                        os.remove(filepath)
            except (json.JSONDecodeError, ValueError):
                pass

        # Adicionar novos arquivos
        if files:
            if task.anexos is None:
                task.anexos = []
            for file in files:
                if file.filename:
                    filename = secure_filename(file.filename)
                    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
                    file.save(filepath)
                    anexo_obj = {
                        "id": filename,
                        "name": filename,
                        "size": os.path.getsize(filepath),
                        "type": file.content_type or "application/octet-stream",
                        "url": f"{request.scheme}://{request.host}/uploads/{filename}"
                    }
                    task.anexos.append(anexo_obj)

    # Tags e lembretes
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

    task.updated_at = datetime.utcnow()
    db.session.commit()

    if task.lembretes and task.due_date:
        schedule_task_reminders_safe(task)

    return jsonify(task.to_dict())


@task_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    user_id = int(get_jwt_identity()) # Garante que user_id é um inteiro
    user = User.query.get(user_id)
    task = Task.query.get(task_id)

    print(f"[DEBUG] User ID logado (int): {user_id}")
    print(f"[DEBUG] Task ID: {task_id}")

    
    if not task:
        print(f"[DEBUG] Tarefa {task_id} não encontrada.")
        return jsonify({"error": "Tarefa não encontrada"}), 404

    print(f"[DEBUG] Task user_id (type {type(task.user_id)}): {task.user_id}")
    print(f"[DEBUG] Task assigned_by_user_id (type {type(task.assigned_by_user_id)}): {task.assigned_by_user_id}")
    print(f"[DEBUG] User is_admin: {user.is_admin}")

    # Logs detalhados para cada parte da condição can_delete
    print(f"[DEBUG] Condição 1 (user.is_admin): {user.is_admin}")
    print(f"[DEBUG] Condição 2 (task.user_id == user_id): {task.user_id == user_id}")
    print(f"[DEBUG] Condição 3 (task.assigned_by_user_id == user_id): {task.assigned_by_user_id == user_id}")
    print(f"[DEBUG] Condição 4 (task.user_id == user_id and task.assigned_by_user_id is None): {task.user_id == user_id and task.assigned_by_user_id is None}")

    can_delete = (
        user.is_admin or 
        task.user_id == user_id or 
        (task.assigned_by_user_id == user_id) or 
        (task.user_id == user_id and task.assigned_by_user_id is None)
    )
    
    print(f"[DEBUG] can_delete (final): {can_delete}")

    if not can_delete:
        is_collaborator = user_id in (task.collaborators or [])
        print(f"[DEBUG] is_collaborator: {is_collaborator}")
        if is_collaborator:
            print("[DEBUG] Acesso negado: Colaborador.")
            return jsonify({"error": "Colaboradores não podem excluir tarefas. Apenas o criador, responsável ou gestor podem fazer isso."}), 403
        else:
            print("[DEBUG] Acesso negado: Sem permissão geral.")
            return jsonify({"error": "Você não tem permissão para excluir esta tarefa."}), 403

    # Remover anexos físicos
    if task.anexos:
        for anexo in task.anexos:
            if isinstance(anexo, dict) and "name" in anexo:
                filename = anexo["name"]
            else:
                filename = str(anexo)
            
            filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"[DEBUG] Arquivo removido: {filepath}")
                except OSError as e:
                    print(f"[DEBUG] Erro ao remover arquivo {filepath}: {e}")

    db.session.delete(task)
    db.session.commit()

    return jsonify({"message": "Tarefa excluída com sucesso"})

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
        # Excluir o usuário atual (gestor) da lista de membros para atribuição
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

    # Parâmetros de filtro
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")
    status = request.args.get("status")
    priority = request.args.get("priority")
    category = request.args.get("category")

    query = Task.query.filter(or_(
        Task.user_id == user_id,  # Tarefas atribuídas ao usuário
        Task.assigned_by_user_id == user_id,  # Tarefas criadas pelo usuário
        text("tasks.assigned_users::jsonb @> :user_id_json").params(user_id_json=f'[{user_id}]'), # Tarefas onde o usuário é um dos atribuídos
        text("tasks.collaborators::jsonb @> :user_id_json").params(user_id_json=f'[{user_id}]') # Tarefas onde o usuário é colaborador
    ))

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

    # Agregação de dados para o relatório
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
    now = datetime.utcnow()

    for task in tasks:
        task_dict = task.to_dict()

        # converter due_date para timezone de Brasil
        due_date_local = task.due_date.replace(tzinfo=timezone("UTC")).astimezone(brazil_tz) if task.due_date else None
        
        if due_date_local:
            if due_date_local < now_brazil and task.status != 'done':
                report_data["overdue_tasks"] += 1
            elif due_date_local > now_brazil and task.status != 'done':
                report_data["upcoming_tasks"] += 1

        report_data["detailed_tasks"].append(task_dict)

        # Contagem por status
        report_data["tasks_by_status"][task.status] = report_data["tasks_by_status"].get(task.status, 0) + 1

        # Contagem por prioridade
        if task.prioridade:
            report_data["tasks_by_priority"][task.prioridade] = report_data["tasks_by_priority"].get(task.prioridade, 0) + 1

        # Contagem por categoria
        if task.categoria:
            report_data["tasks_by_category"][task.categoria] = report_data["tasks_by_category"].get(task.categoria, 0) + 1

        # Tarefas concluídas no prazo ou atrasadas
        if task.status == 'done' and task.due_date:
            if task.updated_at and task.updated_at <= task.due_date:
                report_data["tasks_completed_on_time"] += 1
            else:
                report_data["tasks_completed_late"] += 1
            
            # Calcular tempo de conclusão se houver created_at e updated_at
            if task.created_at and task.updated_at:
                time_taken = (task.updated_at - task.created_at).total_seconds()
                completed_tasks_times.append(time_taken)

        # Tarefas atrasadas e próximas
        if task.due_date:
            if task.due_date < now and task.status != 'done':
                report_data["overdue_tasks"] += 1
            elif task.due_date > now and task.status != 'done':
                report_data["upcoming_tasks"] += 1

    # Calcular tempo médio de conclusão
    if completed_tasks_times:
        avg_seconds = sum(completed_tasks_times) / len(completed_tasks_times)
        # Converter segundos para um formato mais legível (ex: dias, horas, minutos)
        days = int(avg_seconds // (24 * 3600))
        hours = int((avg_seconds % (24 * 3600)) // 3600)
        minutes = int((avg_seconds % 3600) // 60)
        report_data["average_completion_time"] = f"{days}d {hours}h {minutes}m"

    return jsonify(report_data)


