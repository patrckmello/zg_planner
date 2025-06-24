from app import app
from extensions import db
from models import User

with app.app_context():
    db.drop_all()  # Dropa todas as tabelas antigas (para recriar com a nova definição)
    db.create_all()
    print("Banco de dados recriado com sucesso!")