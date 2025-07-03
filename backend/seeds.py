from extensions import db
from models.user_model import User
from models.role_model import Role

def seed_roles():
    cargos = ['Sócio', 'Advogado', 'Estagiário', 'TI']
    for nome in cargos:
        role = Role.query.filter_by(name=nome).first()
        if not role:
            db.session.add(Role(name=nome))
    db.session.commit()

def seed_admin():
    admin = User.query.filter_by(email='admin@admin.com').first()
    if not admin:
        admin = User(
            username='Administrador',
            email='admin@admin.com',
            is_admin=True
        )
        admin.set_password('admin')  # Aqui seta a senha corretamente
        db.session.add(admin)
        db.session.commit()

def run_seeds():
    seed_roles()
    seed_admin()
