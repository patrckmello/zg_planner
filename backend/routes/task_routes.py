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

task_bp = Blueprint('tasks', __name__, url_prefix='/api')

@task_bp.route('/tasks', methods=['GET'])
@jwt_required()
def get_tasks():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({'msg': 'Usuário inválido ou inativo'}), 401

    status = request.args.get('status')
    due_before = request.args.get('due_before')
    due_after = request.args.get('due_after')
    search = request.args.get('search')

    if user.is_admin:
        query = Task.query
    else:
        # Verifica se o usuário é gestor de algum time
        manager_team_ids = [
            assoc.team_id for assoc in user.teams if assoc.is_manager
        ]

        # Se for gestor, pega tarefas pessoais + tarefas da equipe que ele gerencia
        if manager_team_ids:
            query = Task.query.filter(
                (Task.user_id == user_id) | (Task.team_id.in_(manager_team_ids))
            )
        else:
            # User comum: tarefas pessoais + tarefas das equipes em que participa
            member_team_ids = [assoc.team_id for assoc in user.teams]
            query = Task.query.filter(
                (Task.user_id == user_id) | (Task.team_id.in_(member_team_ids))
            )

    if status:
        if status not in ['pending', 'done', 'in_progress', 'cancelled']:
            return jsonify({'error': 'Status inválido para filtro.'}), 400
        query = query.filter(Task.status == status)

    from datetime import datetime

    if due_before:
        try:
            due_before_date = datetime.fromisoformat(due_before)
            query = query.filter(Task.due_date != None, Task.due_date <= due_before_date)
        except ValueError:
            return jsonify({'error': 'Formato inválido para due_before. Use ISO 8601.'}), 400

    if due_after:
        try:
            due_after_date = datetime.fromisoformat(due_after)
            query = query.filter(Task.due_date != None, Task.due_date >= due_after_date)
        except ValueError:
            return jsonify({'error': 'Formato inválido para due_after. Use ISO 8601.'}), 400

    if search:
        query = query.filter(Task.title.ilike(f'%{search}%'))

    tasks = query.all()

    # Enriquecer dados dos anexos com URLs completas
    tasks_data = []
    for task in tasks:
        task_dict = task.to_dict()

        if task_dict.get('anexos'):
            anexos_enriched = []
            for anexo in task_dict['anexos']:
                if isinstance(anexo, str):
                    anexo_obj = {
                        'id': anexo,
                        'name': anexo,
                        'url': f"http://10.1.39.126:5555/uploads/{anexo}",
                        'size': 0,
                        'type': 'application/octet-stream'
                    }
                else:
                    anexo_obj = anexo.copy()
                    if 'url' not in anexo_obj:
                        anexo_obj['url'] = f"http://10.1.39.126:5555/uploads/{anexo_obj.get('name', '')}"
                anexos_enriched.append(anexo_obj)
            task_dict['anexos'] = anexos_enriched

        tasks_data.append(task_dict)

    return jsonify(tasks_data)


@task_bp.route('/tasks', methods=['POST'])
@jwt_required()
def add_task():
    from datetime import datetime 
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if request.content_type.startswith('multipart/form-data'):
            data = request.form
            files = request.files.getlist('anexos')
        else:
            return jsonify({'error': 'Tipo de requisição inválido. Envie como multipart/form-data.'}), 400

        if not data.get('title'):
            return jsonify({'error': 'O campo título é obrigatório.'}), 400

        due_date = None
        if data.get('due_date'):
            try:
                due_date = datetime.fromisoformat(data['due_date'])
            except ValueError:
                return jsonify({'error': 'Formato inválido para due_date. Use ISO 8601.'}), 400

        # 🔑 Lógica para validar criação de tarefa de equipe
        team_id = data.get('team_id')
        if team_id:
            try:
                team_id = int(team_id)
            except ValueError:
                return jsonify({'error': 'team_id inválido'}), 400

            team = Team.query.get(team_id)
            if not team:
                return jsonify({'error': 'Time não encontrado.'}), 404

            # Verifica se o user é manager da equipe
            is_manager = any(assoc.is_manager and assoc.team_id == team.id for assoc in user.teams)
            if not is_manager:
                return jsonify({'error': 'Você não tem permissão para criar tarefas neste time.'}), 403
        else:
            team_id = None  # tarefa pessoal

        # Processar anexos com metadados completos
        anexos_data = []
        for file in files:
            if file.filename:
                filename = secure_filename(file.filename)
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                
                anexo_obj = {
                    'id': filename,
                    'name': filename,
                    'size': os.path.getsize(filepath),
                    'type': file.content_type or 'application/octet-stream',
                    'url': f"http://10.1.39.126:5555/uploads/{filename}"
                }
                anexos_data.append(anexo_obj)

        try:
            lembretes = json.loads(data.get('lembretes', '[]'))
        except Exception:
            lembretes = []

        try:
            tags = json.loads(data.get('tags', '[]'))
        except Exception:
            tags = []

        # Criação da task
        new_task = Task(
            title=data['title'],
            description=data.get('description'),
            status=data.get('status', 'pending'),
            due_date=due_date,
            user_id=user_id,
            team_id=team_id,
            prioridade=data.get('prioridade'),
            categoria=data.get('categoria'),
            status_inicial=data.get('status_inicial'),
            tempo_estimado=data.get('tempo_estimado'),
            tempo_unidade=data.get('tempo_unidade'),
            relacionado_a=data.get('relacionado_a'),
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
        return jsonify({'error': 'Erro interno no servidor', 'message': str(e)}), 500


@task_bp.route('/tasks/<int:task_id>', methods=['GET'])
@jwt_required()
def get_task(task_id):
    user_id = get_jwt_identity()
    task = Task.query.get(task_id)

    if task is None:
        return jsonify({'error': 'Tarefa não encontrada'}), 404

    if task.user_id != user_id:
        return jsonify({'error': 'Acesso negado'}), 403

    task_dict = task.to_dict()
    
    # Enriquecer anexos com URLs completas
    if task_dict.get('anexos'):
        anexos_enriched = []
        for anexo in task_dict['anexos']:
            if isinstance(anexo, str):
                # Se anexo é apenas um nome de arquivo (formato antigo)
                anexo_obj = {
                    'id': anexo,
                    'name': anexo,
                    'url': f"http://10.1.39.126:5555/uploads/{anexo}",
                    'size': 0,
                    'type': 'application/octet-stream'
                }
            else:
                # Se anexo já é um objeto (formato novo)
                anexo_obj = anexo.copy()
                if 'url' not in anexo_obj:
                    anexo_obj['url'] = f"http://10.1.39.126:5555/uploads/{anexo_obj.get('name', '')}"
            
            anexos_enriched.append(anexo_obj)
        
        task_dict['anexos'] = anexos_enriched

    return jsonify(task_dict)

@task_bp.route('/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    from flask_jwt_extended import get_jwt_identity

    user_id = get_jwt_identity()
    print(f"[DEBUG] Usuário autenticado: {user_id}")

    task = Task.query.get(task_id)

    if not task:
        return jsonify({'error': 'Tarefa não encontrada'}), 404

    print(f"[DEBUG] Tarefa encontrada: user_id={task.user_id}")

    user = User.query.get(user_id)
    if not user.is_admin and str(task.user_id) != str(user_id):
        print("[DEBUG] Acesso negado: user_id não corresponde ao dono da tarefa e não é admin")
        return jsonify({'error': 'Acesso negado'}), 403

    if request.content_type and request.content_type.startswith('multipart/form-data'):
        data = request.form
        files = request.files.getlist('new_files')

        # Pega anexos existentes que devem ser mantidos
        existing_files_json = data.get('existing_files', '[]')
        try:
            existing_files = json.loads(existing_files_json)
        except Exception:
            existing_files = []

        # Pega anexos que devem ser removidos (NOVA FUNCIONALIDADE)
        files_to_remove_json = data.get('files_to_remove', '[]')
        try:
            files_to_remove = json.loads(files_to_remove_json)
        except Exception:
            files_to_remove = []

        print(f"Arquivos a serem mantidos: {existing_files}")
        print(f"Arquivos a serem removidos: {files_to_remove}")

        # Remover arquivos fisicamente da pasta uploads
        for filename in files_to_remove:
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"Arquivo removido fisicamente: {filepath}")
                except Exception as e:
                    print(f"Erro ao remover arquivo {filepath}: {e}")

        # Manter anexos existentes (objetos completos)
        anexos_mantidos = []
        current_anexos = task.anexos or []
        
        for anexo_atual in current_anexos:
            if isinstance(anexo_atual, str):
                # Formato antigo: apenas nome do arquivo
                if anexo_atual in existing_files:
                    anexo_obj = {
                        'id': anexo_atual,
                        'name': anexo_atual,
                        'url': f"http://10.1.39.126:5555/uploads/{anexo_atual}",
                        'size': 0,
                        'type': 'application/octet-stream'
                    }
                    anexos_mantidos.append(anexo_obj)
            else:
                # Formato novo: objeto completo
                if anexo_atual.get('name') in existing_files:
                    anexos_mantidos.append(anexo_atual)

        # Processar novos arquivos
        novos_anexos = []
        for file in files:
            if file and file.filename:
                filename = secure_filename(file.filename)
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                
                # Criar objeto anexo com metadados
                anexo_obj = {
                    'id': filename,
                    'name': filename,
                    'size': os.path.getsize(filepath),
                    'type': file.content_type or 'application/octet-stream',
                    'url': f"http://10.1.39.126:5555/uploads/{filename}"
                }
                novos_anexos.append(anexo_obj)

        # Combinar anexos mantidos + novos anexos
        task.anexos = anexos_mantidos + novos_anexos

        # Atualiza os demais campos
        if 'title' in data:
            task.title = data['title']
        if 'description' in data:
            task.description = data['description']

        if 'status' in data:
            if data['status'] not in ['pending', 'in_progress', 'done', 'cancelled']:
                return jsonify({'error': 'Status inválido'}), 400
            task.status = data['status']

        if 'due_date' in data:
            if not data['due_date']:
                task.due_date = None
            else:
                try:
                    task.due_date = datetime.fromisoformat(data['due_date'])
                except ValueError:
                    return jsonify({'error': 'Formato inválido para due_date. Use ISO 8601.'}), 400

        task.prioridade = data.get('prioridade', task.prioridade)
        task.categoria = data.get('categoria', task.categoria)
        task.status_inicial = data.get('status_inicial', task.status_inicial)
        task.tempo_estimado = data.get('tempo_estimado', task.tempo_estimado)
        task.tempo_unidade = data.get('tempo_unidade', task.tempo_unidade)
        task.relacionado_a = data.get('relacionadoA', task.relacionado_a)

        try:
            task.lembretes = json.loads(data.get('lembretes', '[]'))
        except Exception:
            task.lembretes = task.lembretes or []

        try:
            task.tags = json.loads(data.get('tags', '[]'))
        except Exception:
            task.tags = task.tags or []

    else:
        # Caso queira aceitar JSON puro
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Dados inválidos'}), 400

        task.title = data.get('title', task.title)
        task.description = data.get('description', task.description)

        status = data.get('status', task.status)
        if status not in ['pending', 'in_progress', 'done', 'cancelled']:
            return jsonify({'error': 'Status inválido'}), 400
        task.status = status

        due_date_str = data.get('due_date')
        if due_date_str:
            try:
                task.due_date = datetime.fromisoformat(due_date_str)
            except ValueError:
                return jsonify({'error': 'Formato inválido para due_date. Use ISO 8601.'}), 400
        else:
            task.due_date = None

        task.prioridade = data.get('prioridade', task.prioridade)
        task.categoria = data.get('categoria', task.categoria)
        task.status_inicial = data.get('status_inicial', task.status_inicial)
        task.tempo_estimado = data.get('tempo_estimado', task.tempo_estimado)
        task.tempo_unidade = data.get('tempo_unidade', task.tempo_unidade)
        task.relacionado_a = data.get('relacionadoA', task.relacionado_a)

        try:
            task.lembretes = data.get('lembretes', task.lembretes or [])
            if isinstance(task.lembretes, str):
                task.lembretes = json.loads(task.lembretes)
        except Exception:
            task.lembretes = task.lembretes or []

        try:
            task.tags = data.get('tags', task.tags or [])
            if isinstance(task.tags, str):
                task.tags = json.loads(task.tags)
        except Exception:
            task.tags = task.tags or []

    db.session.commit()
    return jsonify(task.to_dict())

@task_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    user_id = get_jwt_identity()
    task = Task.query.get(task_id)

    if not task:
        return jsonify({'error': 'Tarefa não encontrada'}), 404

    print(f"[DEBUG] Tarefa encontrada: user_id={task.user_id}")

    user = User.query.get(user_id)
    if not user.is_admin and str(task.user_id) != str(user_id):
        print("[DEBUG] Acesso negado: user_id não corresponde ao dono da tarefa e não é admin")
        return jsonify({'error': 'Acesso negado'}), 403

    # Remover arquivos anexados do sistema de arquivos
    if task.anexos:
        for anexo in task.anexos:
            if isinstance(anexo, str):
                filename = anexo
            else:
                filename = anexo.get("name")
            
            if filename:
                filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                        print(f"Arquivo removido: {filepath}")
                    except Exception as e:
                        print(f"Erro ao remover arquivo {filepath}: {e}")

    db.session.delete(task)
    db.session.commit()

    return jsonify({"message": "Tarefa excluída com sucesso!"})

@task_bp.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)