# app.py
from flask import Flask, jsonify, session, redirect, url_for, send_from_directory, request
from extensions import db
from flask_cors import CORS
from flask_migrate import Migrate
from seeds import run_seeds
from dotenv import load_dotenv
import os, atexit, logging
from flask_jwt_extended import jwt_required, JWTManager
from datetime import timedelta
from flasgger import Swagger

# Models (ordem importa)
from models.user_model import User
from models.role_model import Role
from models.team_model import Team
from models.user_team_model import UserTeam
from models.task_model import Task
from models.comment_model import Comment
from models.backup_model import Backup
from models.audit_log_model import AuditLog
from models.notification_outbox_model import NotificationOutbox  # ADD

# Blueprints
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.team_routes import team_bp
from routes.task_routes import task_bp
from routes.role_routes import role_bp
from routes.comment_routes import comment_bp
from routes.admin_routes import admin_bp
from routes.backup_routes import backup_bp
from routes.debug_routes import debug_bp  # ADD
from routes.archive_debug_routes import archive_debug_bp

# Schedulers
from mailer_scheduler import init_mailer_scheduler, stop_mailer_scheduler
from purge_scheduler import init_purge_scheduler, stop_purge_scheduler, purge_trash_once
from archive_scheduler import init_archive_scheduler, stop_archive_scheduler
from backup_scheduler import init_backup_scheduler
from reminder_scheduler import init_reminder_scheduler, stop_reminder_scheduler

load_dotenv()

app = Flask(__name__)

# ---- Logging básico (INFO) ----
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")

# ---- JWT / Flask ----
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

# ---- Swagger ----
app.config['SWAGGER'] = {"title": "ZG Planner API", "uiversion": 3}
swagger_template = {
    "swagger": "2.0",
    "info": {"title": "ZG Planner API", "description": "Documentação dos endpoints", "version": "1.0.0"},
    "basePath": "/", "schemes": ["http", "https"],
    "securityDefinitions": {"BearerAuth": {"type": "apiKey", "name": "Authorization", "in": "header",
                                           "description": "Use: **Bearer &lt;seu_token_jwt&gt;**"}},
    "security": [{"BearerAuth": []}],
}
swagger = Swagger(app, template=swagger_template)

# ---- Extensões ----
db.init_app(app)
migrate = Migrate(app, db)
CORS(app, supports_credentials=True)
jwt = JWTManager(app)

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    try:
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)
    except FileNotFoundError:
        return jsonify({"error": "Arquivo não encontrado"}), 404

# ---- Blueprints ----
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(team_bp)
app.register_blueprint(task_bp)
app.register_blueprint(role_bp)
app.register_blueprint(comment_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(backup_bp)
app.register_blueprint(debug_bp)
app.register_blueprint(archive_debug_bp)

from werkzeug.local import LocalProxy

@app.before_request
def _start_schedulers_once():
    if getattr(app, "_schedulers_started", False):
        return

    if request.endpoint in (None, "static"):
        return

    app._schedulers_started = True

    # Schedulers principais
    init_reminder_scheduler(app)
    init_purge_scheduler(app)
    init_archive_scheduler(app)
    init_mailer_scheduler(app)
    app.logger.info("[SCHED] Todos os schedulers iniciados (reminder, purge, archive, mailer).")

    # Backup
    backup_sched = init_backup_scheduler(app)
    backup_sched.start()
    app.logger.info("[BACKUP] Scheduler de backups iniciado.")

# ---- Encerrar schedulers no shutdown ----
atexit.register(stop_reminder_scheduler)
atexit.register(stop_purge_scheduler)
atexit.register(stop_archive_scheduler)
atexit.register(stop_mailer_scheduler)

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    else:
        return redirect(url_for('login'))

@app.route('/api/dashboard')
@jwt_required()
def dashboard():
    return jsonify({'message': 'Bem-vindo ao dashboard!'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        run_seeds()
    app.run(debug=True, host='0.0.0.0', port=5555)
