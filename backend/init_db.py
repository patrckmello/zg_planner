from app import app
from extensions import db

from models.user_model import User
from models.role_model import Role
from models.team_model import Team
from models.user_team_model import UserTeam
from models.task_model import Task
from models.comment_model import Comment

def create_db():
    with app.app_context():
        print("🔄 Criando tabelas do banco de dados...")
        db.create_all()
        print("✅ Banco de dados criado com sucesso!")
        print("📋 Tabelas criadas:")
        print("   - users")
        print("   - roles") 
        print("   - teams")
        print("   - user_teams")
        print("   - tasks")
        print("   - comments")

if __name__ == '__main__':
    create_db()

