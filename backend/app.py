# from flask import Flask, jsonify, session, redirect, url_for, send_from_directory, render_template
# from extensions import db
# from flask_cors import CORS
# from flask_migrate import Migrate
# from seeds import run_seeds
# from dotenv import load_dotenv
# import os
# from functools import wraps
# from flask_jwt_extended import jwt_required
# from flask_jwt_extended import JWTManager
# from datetime import timedelta

# from models.user_model import User
# from models.team_model import Team
# from models.user_team_model import UserTeam
# from models.task_model import Task
# from models.role_model import Role

# # Importa os blueprints
# from routes.auth_routes import auth_bp
# from routes.user_routes import user_bp
# from routes.team_routes import team_bp
# from routes.task_routes import task_bp
# from routes.role_routes import role_bp

# load_dotenv()


# app = Flask(__name__, static_folder="static", template_folder="templates")


# # REGISTRA OS BLUEPRINTS
# app.register_blueprint(auth_bp)
# app.register_blueprint(user_bp)
# app.register_blueprint(team_bp)
# app.register_blueprint(task_bp)
# app.register_blueprint(role_bp)

# load_dotenv()

# app.config['JWT_SECRET_KEY'] = 'sua_chave_secreta'  # já deve ter isso
# app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)  # token curto
# app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)     # refresh + longo
# app.config['JWT_TOKEN_LOCATION'] = ['headers']  # ou ['headers', 'cookies'] se for usar cookies
# app.config['JWT_COOKIE_SECURE'] = False  # True se estiver em HTTPS

# app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

# UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
# os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# migrate = Migrate(app, db)

# CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

# jwt = JWTManager(app)

# db.init_app(app)

# @app.route('/', defaults={'path': ''})
# @app.route('/<path:path>')
# def serve_frontend(path):
#     if path.startswith('api/') or path.startswith('uploads/'):
#         return jsonify({'error': 'API ou upload não encontrados'}), 404
#     if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
#         return send_from_directory(app.static_folder, path)
#     return render_template("index.html")

# @app.route('/api/dashboard')
# @jwt_required()
# def dashboard():
#     return jsonify({'message': 'Bem-vindo ao dashboard!'})

# if __name__ == '__main__':
#     with app.app_context():
#         db.create_all()
#         # Seeds (só pra dev/teste)
#         run_seeds()
#     app.run(debug=True, host='0.0.0.0', port=5555)

from flask import Flask, jsonify, session, redirect, url_for
from extensions import db
from flask_cors import CORS
from flask_migrate import Migrate
from seeds import run_seeds
from dotenv import load_dotenv
import os
from flask_jwt_extended import jwt_required, JWTManager
from datetime import timedelta

from models.user_model import User
from models.team_model import Team
from models.user_team_model import UserTeam
from models.task_model import Task
from models.role_model import Role

from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.team_routes import team_bp
from routes.task_routes import task_bp
from routes.role_routes import role_bp

load_dotenv()

app = Flask(__name__)

# Configurações do Flask
app.config['JWT_SECRET_KEY'] = 'sua_chave_secreta'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_COOKIE_SECURE'] = False

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Inicializa extensões
db.init_app(app)
migrate = Migrate(app, db)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "http://localhost:5173"}})
jwt = JWTManager(app)

# Registra blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(team_bp)
app.register_blueprint(task_bp)
app.register_blueprint(role_bp)

primeira_vez = True

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    else:
        return redirect(url_for('login'))  # Ou redirecione para frontend se quiser

@app.route('/api/dashboard')
@jwt_required()
def dashboard():
    return jsonify({'message': 'Bem-vindo ao dashboard!'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        run_seeds()
    app.run(debug=True, host='0.0.0.0', port=5555)