from app import app
from extensions import db
from models import User, Task  # importando os modelos corretamente

def create_db():
    with app.app_context():
        db.create_all()
        print("✅ Banco de dados criado com sucesso!")

if __name__ == '__main__':
    create_db()

