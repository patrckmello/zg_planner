from extensions import db

class Role(db.Model):
    __tablename__ = 'roles'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

    # Se quiser relacionar usuários a cargos, pode fazer aqui
    users = db.relationship('User', backref='role', lazy=True)
