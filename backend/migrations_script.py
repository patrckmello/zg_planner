#!/usr/bin/env python3
"""
Script de migração para adicionar as novas funcionalidades de perfil e configurações
Execute este script após atualizar os modelos
"""

from flask import Flask
from extensions import db
from models.user_model import User
from models.backup_model import Backup
from models.audit_log_model import AuditLog
import os
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app

def run_migrations():
    """Executa as migrações necessárias"""
    app = create_app()
    
    with app.app_context():
        print("Criando tabelas...")
        
        # Criar todas as tabelas (incluindo as novas)
        db.create_all()
        
        print("Tabelas criadas com sucesso!")
        
        # Adicionar campo icon_color aos usuários existentes (se necessário)
        try:
            # Verificar se existem usuários sem cor definida
            users_without_color = User.query.filter_by(icon_color=None).all()
            
            for user in users_without_color:
                user.icon_color = '#3498db'  # Cor padrão
            
            if users_without_color:
                db.session.commit()
                print(f"Cor padrão definida para {len(users_without_color)} usuários")
            
        except Exception as e:
            print(f"Erro ao atualizar cores dos usuários: {e}")
        
        print("Migrações concluídas!")

if __name__ == '__main__':
    run_migrations()

