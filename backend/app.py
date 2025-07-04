from flask import Flask, jsonify, session, redirect, url_for
from extensions import db
from flask_cors import CORS
from flask_migrate import Migrate
from seeds import run_seeds
from dotenv import load_dotenv
import os
from functools import wraps
from flask_jwt_extended import jwt_required
from flask_jwt_extended import JWTManager
from datetime import timedelta

from models.user_model import User
from models.team_model import Team
from models.user_team_model import UserTeam
from models.task_model import Task
from models.role_model import Role

# Importa os blueprints
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.team_routes import team_bp
from routes.task_routes import task_bp
from routes.role_routes import role_bp

load_dotenv()


app = Flask(__name__)




# REGISTRA OS BLUEPRINTS
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(team_bp)
app.register_blueprint(task_bp)
app.register_blueprint(role_bp)

load_dotenv()

app.config['JWT_SECRET_KEY'] = 'sua_chave_secreta'  # já deve ter isso
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)  # token curto
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)     # refresh + longo
app.config['JWT_TOKEN_LOCATION'] = ['headers']  # ou ['headers', 'cookies'] se for usar cookies
app.config['JWT_COOKIE_SECURE'] = False  # True se estiver em HTTPS

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

migrate = Migrate(app, db)

CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "http://localhost:5173"}})

jwt = JWTManager(app)

db.init_app(app)

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    else:
        return redirect(url_for('login'))  # Ou para uma rota de frontend: redirect("http://localhost:5173/login")

@app.route('/api/dashboard')
@jwt_required()
def dashboard():
    return jsonify({'message': 'Bem-vindo ao dashboard!'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Seeds (só pra dev/teste)
        run_seeds()
    app.run(debug=True, host='0.0.0.0', port=5555)

