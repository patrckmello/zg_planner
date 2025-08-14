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

task_bp = Blueprint("tasks", __name__, url_prefix="/api")

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
    team_member_ids = request.args.get("team_member_ids") # Para filtro de equipe
    collaborator_id = request.args.get("collaborator_id") # Para filtro de colaborador

    if user.is_admin:
        query = Task.query
    else:
        # Verifica se o usuário é gestor de algum time
        manager_team_ids = [
            assoc.team_id for assoc in user.teams if assoc.is_manager
        ]

        # Obter IDs das equipes onde o usuário é membro
        member_team_ids = [assoc.team_id for assoc in user.teams]

        # CORREÇÃO: Usar operadores JSONB corretos para PostgreSQL
        # Tarefas que o usuário pode ver:
        # 1. Tarefas pessoais (user_id == user_id)
        # 2. Tarefas que ele atribuiu (assigned_by_user_id == user_id)
        # 3. Tarefas das equipes que ele gerencia
        # 4. Tarefas onde ele é colaborador (usando operador JSONB)
        # 5. Tarefas das equipes em que ele participa
        # 6. Tarefas onde ele está na lista de assigned_users
        
        conditions = [
            Task.user_id == user_id,
            Task.assigned_by_user_id == user_id
        ]
        
        # Adicionar condições de equipes se o usuário pertence a alguma
        if manager_team_ids:
            conditions.append(Task.team_id.in_(manager_team_ids))
        
        if member_team_ids:
            conditions.append(Task.team_id.in_(member_team_ids))
        
        conditions.append(text("tasks.collaborators::jsonb @> CAST(:user_id_json AS jsonb)").params(user_id_json=f'[{user_id}]'))
        conditions.append(text("tasks.assigned_users::jsonb @> CAST(:user_id_json AS jsonb)").params(user_id_json=f'[{user_id}]'))
        
        query = Task.query.filter(or_(*conditions))

    if status:
        if status not in ["pending", "done", "in_progress", "cancelled"]:
            return jsonify({"error": "Status inválido para filtro."}), 400
        query = query.filter(Task.status == status)

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

    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))

    if assigned_by_user_id:
        try:
            assigned_by_user_id = int(assigned_by_user_id)
            query = query.filter(Task.assigned_by_user_id == assigned_by_user_id)
        except ValueError:
            return jsonify({"error": "assigned_by_user_id inválido."}), 400

    if team_member_ids:
        try:
            team_member_ids = json.loads(team_member_ids)
            if not isinstance(team_member_ids, list):
                raise ValueError("team_member_ids deve ser uma lista de IDs.")
            query = query.filter(Task.user_id.in_(team_member_ids))
        except (json.JSONDecodeError, ValueError):
            return jsonify({"error": "Formato inválido para team_member_ids. Use um array JSON de IDs."}), 400

    if collaborator_id:
        try:
            collaborator_id = int(collaborator_id)
            # CORREÇÃO: Usar operador JSONB correto
            query = query.filter(text("tasks.collaborators @> :collab_id_json").params(collab_id_json=f'[{collaborator_id}]'))
        except ValueError:
            return jsonify({"error": "collaborator_id inválido."}), 400

    tasks = query.all()

    # Enriquecer dados dos anexos com URLs completas
    tasks_data = []
    for task in tasks:
        task_dict = task.to_dict()

        if task_dict.get("anexos"):
            anexos_enriched = []
            for anexo in task_dict["anexos"]:
                if isinstance(anexo, str):
                    anexo_obj = {
                        "id": anexo,
                        "name": anexo,
                        "url": f"{request.scheme}://{request.host}/uploads/{anexo}",  # CORREÇÃO: URL dinâmica
                        "size": 0,
                        "type": "application/octet-stream"
                    }
                else:
                    anexo_obj = anexo.copy()
                    if "url" not in anexo_obj:
                        anexo_obj["url"] = f"{request.scheme}://{request.host}/uploads/{anexo_obj.get('name', '')}"  # CORREÇÃO: URL dinâmica
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
                # Remover timezone info se presente para comparação consistente
                if due_date.tzinfo is not None:
                    due_date = due_date.replace(tzinfo=None)
                # Validação: não permitir datas passadas
                if due_date < datetime.utcnow():
                    return jsonify({"error": "A data de vencimento não pode ser no passado."}), 400
            except ValueError:
                return jsonify({"error": "Formato inválido para due_date. Use ISO 8601."}), 400

        # 🔑 Lógica para validar criação de tarefa de equipe
        team_id = data.get("team_id")
        if team_id:
            try:
                team_id = int(team_id)
            except ValueError:
                return jsonify({"error": "team_id inválido"}), 400

            team = Team.query.get(team_id)
            if not team:
                return jsonify({"error": "Time não encontrado."}), 404

            # Verifica se o user é manager da equipe ou admin
            is_manager = user.is_admin or any(assoc.is_manager and assoc.team_id == team.id for assoc in user.teams)
            if not is_manager:
                return jsonify({"error": "Apenas gestores podem criar tarefas para a equipe."}), 403
        else:
            team_id = None  # tarefa pessoal

        # Determinar o user_id da tarefa e assigned_by_user_id
        task_user_id = user_id # Por padrão, a tarefa é para o próprio usuário
        assigned_by_user_id = None

        # CORREÇÃO: Permitir múltiplos usuários atribuídos
        assigned_to_user_ids = data.get("assigned_to_user_ids")
        if assigned_to_user_ids:
            try:
                if assigned_to_user_ids == "all":
                    # Atribuir para todos os membros da equipe
                    if team_id:
                        team_members = UserTeam.query.filter_by(team_id=team_id).all()
                        assigned_to_user_ids = [member.user_id for member in team_members]
                    else:
                        return jsonify({"error": "Não é possível atribuir para 'todos' sem especificar uma equipe."}), 400
                else:
                    assigned_to_user_ids = json.loads(assigned_to_user_ids)
                    if not isinstance(assigned_to_user_ids, list):
                        raise ValueError("assigned_to_user_ids deve ser uma lista de IDs ou 'all'.")
                
                # Validação: apenas gestores podem atribuir tarefas para outros
                if team_id:
                    # Para tarefas de equipe, verificar se o usuário é gestor da equipe
                    is_manager = user.is_admin or any(assoc.is_manager and assoc.team_id == team_id for assoc in user.teams)
                    if not is_manager:
                        return jsonify({"error": "Apenas gestores podem atribuir tarefas para outros membros."}), 403
                    
                    # Verificar se todos os usuários atribuídos são membros da equipe
                    for assigned_to_user_id in assigned_to_user_ids:
                        assigned_user = User.query.get(assigned_to_user_id)
                        if not assigned_user:
                            return jsonify({"error": f"Usuário com ID {assigned_to_user_id} não encontrado."}), 404
                        
                        is_team_member = any(assoc.team_id == team_id for assoc in assigned_user.teams)
                        if not is_team_member:
                            return jsonify({"error": f"O usuário {assigned_user.username} deve ser membro da equipe."}), 400
                else:
                    # Para tarefas pessoais, apenas o próprio usuário pode atribuir para si mesmo
                    if len(assigned_to_user_ids) > 1 or (len(assigned_to_user_ids) == 1 and assigned_to_user_ids[0] != user_id):
                        return jsonify({"error": "Você só pode atribuir tarefas pessoais para si mesmo."}), 403
                
                # Se múltiplos usuários, criar UMA tarefa com múltiplos responsáveis
                if len(assigned_to_user_ids) > 1:
                    # Processar colaboradores/observadores existentes
                    collaborators = []
                    if data.get("collaborator_ids"):
                        try:
                            collaborator_ids_data = data.get("collaborator_ids")
                            if collaborator_ids_data == "all":
                                # Adicionar todos os membros da equipe como colaboradores
                                if team_id:
                                    team_members = UserTeam.query.filter_by(team_id=team_id).all()
                                    collaborators = [member.user_id for member in team_members]
                                else:
                                    return jsonify({"error": "Não é possível adicionar 'todos' como colaboradores sem especificar uma equipe."}), 400
                            else:
                                collaborators = json.loads(collaborator_ids_data)
                                if not isinstance(collaborators, list):
                                    raise ValueError("collaborator_ids deve ser uma lista de IDs ou 'all'.")
                            
                            # Validar que todos os colaboradores existem
                            for collab_id in collaborators:
                                collab_user = User.query.get(collab_id)
                                if not collab_user:
                                    return jsonify({"error": f"Colaborador com ID {collab_id} não encontrado."}), 404
                                    
                        except (json.JSONDecodeError, ValueError):
                            return jsonify({"error": "Formato inválido para collaborator_ids. Use um array JSON de IDs ou 'all'."}), 400
                    
                    # Processar anexos com metadados completos
                    anexos_data = []
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
                            anexos_data.append(anexo_obj)

                    try:
                        lembretes = json.loads(data.get("lembretes", "[]"))
                    except Exception:
                        lembretes = []

                    try:
                        tags = json.loads(data.get("tags", "[]"))
                    except Exception:
                        tags = []

                    # Criar UMA tarefa com múltiplos responsáveis
                    # O primeiro usuário é o responsável principal, os outros são adicionados como assigned_users
                    primary_user_id = assigned_to_user_ids[0]
                    additional_assigned_users = assigned_to_user_ids[1:]
                    
                    new_task = Task(
                        title=data["title"],
                        description=data.get("description"),
                        status=data.get("status", "pending"),
                        due_date=due_date,
                        user_id=primary_user_id,
                        assigned_by_user_id=user_id if primary_user_id != user_id else None,
                        collaborators=collaborators,
                        assigned_users=assigned_to_user_ids,  # Todos os usuários atribuídos
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
                    return jsonify(new_task.to_dict()), 201
                else:
                    task_user_id = assigned_to_user_ids[0]
                    assigned_by_user_id = user_id if assigned_to_user_ids[0] != user_id else None
                    
            except (json.JSONDecodeError, ValueError) as e:
                return jsonify({"error": f"Formato inválido para assigned_to_user_ids: {str(e)}"}), 400

        # Processar colaboradores/observadores
        collaborators = []
        if data.get("collaborator_ids"):
            try:
                collaborator_ids_data = data.get("collaborator_ids")
                if collaborator_ids_data == "all":
                    # Adicionar todos os membros da equipe como colaboradores
                    if team_id:
                        team_members = UserTeam.query.filter_by(team_id=team_id).all()
                        collaborators = [member.user_id for member in team_members if member.user_id != task_user_id]
                    else:
                        return jsonify({"error": "Não é possível adicionar 'todos' como colaboradores sem especificar uma equipe."}), 400
                else:
                    collaborators = json.loads(collaborator_ids_data)
                    if not isinstance(collaborators, list):
                        raise ValueError("collaborator_ids deve ser uma lista de IDs ou 'all'.")
                
                # Validar que todos os colaboradores existem
                for collab_id in collaborators:
                    collab_user = User.query.get(collab_id)
                    if not collab_user:
                        return jsonify({"error": f"Colaborador com ID {collab_id} não encontrado."}), 404
                        
            except (json.JSONDecodeError, ValueError):
                return jsonify({"error": "Formato inválido para collaborator_ids. Use um array JSON de IDs ou 'all'."}), 400

        # Processar anexos com metadados completos
        anexos_data = []
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
                    "url": f"{request.scheme}://{request.host}/uploads/{filename}"  # CORREÇÃO: URL dinâmica
                }
                anexos_data.append(anexo_obj)

        try:
            lembretes = json.loads(data.get("lembretes", "[]"))
        except Exception:
            lembretes = []

        try:
            tags = json.loads(data.get("tags", "[]"))
        except Exception:
            tags = []

        # Criação da task
        new_task = Task(
            title=data["title"],
            description=data.get("description"),
            status=data.get("status", "pending"),
            due_date=due_date,
            user_id=task_user_id,
            assigned_by_user_id=assigned_by_user_id,
            collaborators=collaborators,
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
                    "url": f"{request.scheme}://{request.host}/uploads/{anexo}",  # CORREÇÃO: URL dinâmica
                    "size": 0,
                    "type": "application/octet-stream"
                }
            else:
                anexo_obj = anexo.copy()
                if "url" not in anexo_obj:
                    anexo_obj["url"] = f"{request.scheme}://{request.host}/uploads/{anexo_obj.get('name', '')}"  # CORREÇÃO: URL dinâmica
            
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

    # Verificar permissões de edição
    if not task.can_be_viewed_by(user):
        return jsonify({"error": "Acesso negado"}), 403

    if request.is_json:
        data = request.get_json()
        files = []
    elif request.content_type and request.content_type.startswith("multipart/form-data"):
        data = request.form
        files = request.files.getlist("new_files")
    else:
        return jsonify({"error": "Tipo de requisição inválido. Content-Type deve ser application/json ou multipart/form-data."}), 400

    # Validação de data de vencimento
    if data.get("due_date"):
        try:
            due_date = datetime.fromisoformat(data["due_date"])
            # Remover timezone info se presente para comparação consistente
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

    # Atualizar colaboradores (apenas gestores ou admin)
    if data.get("collaborator_ids") is not None:
        if user.is_admin or task.can_be_assigned_by(user):
            try:
                collaborators = json.loads(data["collaborator_ids"])
                if isinstance(collaborators, list):
                    task.collaborators = collaborators
            except (json.JSONDecodeError, ValueError):
                return jsonify({"error": "Formato inválido para collaborator_ids."}), 400
        else:
            return jsonify({"error": "Apenas gestores podem modificar colaboradores."}), 403

    # Atualizar atribuição (apenas gestores ou admin)
    if data.get("assigned_to_user_ids") is not None:
        if user.is_admin or task.can_be_assigned_by(user):
            try:
                assigned_to_user_ids = json.loads(data["assigned_to_user_ids"])
                if isinstance(assigned_to_user_ids, list) and len(assigned_to_user_ids) > 0:
                    # Por enquanto, usar apenas o primeiro usuário da lista
                    # TODO: Implementar suporte completo para múltiplos usuários atribuídos
                    task.user_id = assigned_to_user_ids[0]
                    task.assigned_by_user_id = user_id
            except (json.JSONDecodeError, ValueError):
                return jsonify({"error": "assigned_to_user_ids inválido"}), 400
        else:
            return jsonify({"error": "Apenas gestores podem atribuir tarefas."}), 403
    elif data.get("assigned_to_user_id") is not None:
        if user.is_admin or task.can_be_assigned_by(user):
            try:
                assigned_to_user_id = int(data["assigned_to_user_id"])
                if assigned_to_user_id != task.user_id:
                    task.user_id = assigned_to_user_id
                    task.assigned_by_user_id = user_id
            except ValueError:
                return jsonify({"error": "assigned_to_user_id inválido"}), 400
        else:
            return jsonify({"error": "Apenas gestores podem atribuir tarefas."}), 403

    # Processar anexos (apenas para multipart/form-data)
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        # Obter arquivos existentes que devem ser mantidos
        existing_files_data = data.get("existing_files")
        if existing_files_data:
            try:
                existing_files = json.loads(existing_files_data)
                task.anexos = existing_files
            except (json.JSONDecodeError, ValueError):
                pass
        
        # Obter arquivos que devem ser removidos
        files_to_remove_data = data.get("files_to_remove")
        if files_to_remove_data:
            try:
                files_to_remove = json.loads(files_to_remove_data)
                # Remover arquivos físicos
                for filename in files_to_remove:
                    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
                    if os.path.exists(filepath):
                        os.remove(filepath)
                        print(f"Arquivo removido: {filepath}")
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

