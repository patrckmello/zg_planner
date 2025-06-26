from flask import Flask, request, jsonify, session, make_response, abort, redirect, url_for
from dotenv import load_dotenv
import os
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from extensions import db
from models.user_model import User
from flask_cors import CORS
from flask_migrate import Migrate
from models import User, Task

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

migrate = Migrate(app, db)

CORS(app, supports_credentials=True, origins=["http://localhost:5173"])  # endereço do seu React dev server

db.init_app(app)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login necessário'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email já cadastrado'}), 400

    new_user = User(
        username=data['username'],
        email=data['email']
    )
    new_user.set_password(data['password'])

    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'Usuário registrado com sucesso!'})

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    else:
        return redirect(url_for('login'))  # Ou para uma rota de frontend: redirect("http://localhost:5173/login")

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()

    if user and user.check_password(data['password']):
        session['user_id'] = user.id
        print('Sessão criada:', session.get('user_id'))
        return jsonify({'message': 'Login bem-sucedido!'}), 200
    else:
        return jsonify({'error': 'Credenciais inválidas'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    response = make_response(jsonify({'message': 'Logout bem-sucedido!'}), 200)
    response.set_cookie('session', '', expires=0)  # <-- Expira o cookie manualmente
    return response

@app.route('/api/dashboard')
@login_required
def dashboard():
    return jsonify({'message': 'Bem-vindo ao dashboard!'})

@app.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    user_id = session['user_id']

    # Pega os parâmetros da URL para filtros
    status = request.args.get('status')           # ex: ?status=done
    due_before = request.args.get('due_before')   # ex: ?due_before=2025-07-10T00:00:00
    due_after = request.args.get('due_after')     # ex: ?due_after=2025-07-01T00:00:00
    search = request.args.get('search')           # ex: ?search=API

    query = Task.query.filter_by(user_id=user_id)

    # Filtra por status se fornecido
    if status:
        if status not in ['pending', 'done']:
            return jsonify({'error': 'Status inválido para filtro.'}), 400
        query = query.filter(Task.status == status)

    from datetime import datetime

    # Filtra por data de vencimento antes de determinada data
    if due_before:
        try:
            due_before_date = datetime.fromisoformat(due_before)
            query = query.filter(Task.due_date != None, Task.due_date <= due_before_date)
        except ValueError:
            return jsonify({'error': 'Formato inválido para due_before. Use ISO 8601.'}), 400

    # Filtra por data de vencimento depois de determinada data
    if due_after:
        try:
            due_after_date = datetime.fromisoformat(due_after)
            query = query.filter(Task.due_date != None, Task.due_date >= due_after_date)
        except ValueError:
            return jsonify({'error': 'Formato inválido para due_after. Use ISO 8601.'}), 400

    # Filtra por busca no título (case insensitive)
    if search:
        query = query.filter(Task.title.ilike(f'%{search}%'))

    tasks = query.all()

    tasks_data = [task.to_dict() for task in tasks]

    return jsonify(tasks_data)

@app.route('/api/tasks', methods=['POST'])
@login_required
def add_task():
    from datetime import datetime
    data = request.get_json()
    user_id = session['user_id']

    # Validação mínima
    if not data.get('title'):
        return jsonify({'error': 'O campo título é obrigatório.'}), 400

    # Converte data se existir
    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.fromisoformat(data['due_date'])
        except ValueError:
            return jsonify({'error': 'Formato inválido para due_date. Use ISO 8601.'}), 400

    # Cria nova tarefa com todos os campos possíveis
    new_task = Task(
        title=data['title'],
        description=data.get('description'),
        status=data.get('status', 'pending'),
        due_date=due_date,
        user_id=user_id,

        # 🆕 Novos campos:
        prioridade=data.get('prioridade'),
        categoria=data.get('categoria'),
        status_inicial=data.get('status_inicial'),
        tempo_estimado=data.get('tempo_estimado'),
        tempo_unidade=data.get('tempo_unidade'),
        relacionado_a=data.get('relacionado_a'),
        lembretes=data.get('lembretes'),     # Deve ser uma lista
        tags=data.get('tags'),               # Deve ser uma lista
        anexos=data.get('anexos')            # Lista de links ou nomes
    )

    db.session.add(new_task)
    db.session.commit()

    return jsonify(new_task.to_dict()), 201


@app.route('/api/tasks/<int:task_id>', methods=['GET'])
@login_required
def get_task(task_id):
    user_id = session['user_id']
    task = Task.query.get(task_id)

    if task is None:
        return jsonify({'error': 'Tarefa não encontrada'}), 404

    if task.user_id != user_id:
        return jsonify({'error': 'Acesso negado'}), 403

    return jsonify(task.to_dict())

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    from datetime import datetime
    user_id = session['user_id']
    task = Task.query.get(task_id)

    if task is None:
        return jsonify({'error': 'Tarefa não encontrada'}), 404

    if task.user_id != user_id:
        return jsonify({'error': 'Acesso negado'}), 403

    data = request.get_json()

    # Atualizar campos básicos se vierem no JSON
    if 'title' in data:
        task.title = data['title']
    if 'description' in data:
        task.description = data['description']
    if 'status' in data:
        if data['status'] not in ['pending', 'done']:
            return jsonify({'error': 'Status inválido'}), 400
        task.status = data['status']
    if 'due_date' in data:
        if data['due_date'] is None:
            task.due_date = None
        else:
            try:
                task.due_date = datetime.fromisoformat(data['due_date'])
            except ValueError:
                return jsonify({'error': 'Formato inválido para due_date. Use ISO 8601.'}), 400

    # 🆕 Atualizar campos novos
    if 'prioridade' in data:
        task.prioridade = data['prioridade']
    if 'categoria' in data:
        task.categoria = data['categoria']
    if 'status_inicial' in data:
        task.status_inicial = data['status_inicial']
    if 'tempo_estimado' in data:
        task.tempo_estimado = data['tempo_estimado']
    if 'tempo_unidade' in data:
        task.tempo_unidade = data['tempo_unidade']
    if 'relacionado_a' in data:
        task.relacionado_a = data['relacionado_a']
    if 'lembretes' in data:
        task.lembretes = data['lembretes']  # espera lista de strings
    if 'tags' in data:
        task.tags = data['tags']            # espera lista de strings
    if 'anexos' in data:
        task.anexos = data['anexos']        # espera lista de strings

    db.session.commit()

    return jsonify(task.to_dict())



@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    user_id = session['user_id']
    task = Task.query.get(task_id)

    if task is None:
        return jsonify({'error': 'Tarefa não encontrada'}), 404

    if task.user_id != user_id:
        return jsonify({'error': 'Acesso negado'}), 403

    db.session.delete(task)
    db.session.commit()

    return jsonify({'message': 'Tarefa excluída com sucesso!'})

@app.route('/api/check-session')
def check_session():
    print('Sessão atual:', session.get('user_id'))
    return jsonify({'logged_in': 'user_id' in session})


if __name__ == '__main__':
    app.run(debug=True)