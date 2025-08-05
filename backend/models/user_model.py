from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

user_roles = db.Table('user_roles',
    db.Column('user_username', db.String, db.ForeignKey('users.username')),
    db.Column('role_id', db.Integer, db.ForeignKey('roles.id'))
)

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)

    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=True)
    roles = db.relationship('Role', secondary=user_roles, back_populates='users')

    tasks = db.relationship(
        'Task',
        back_populates='user',
        foreign_keys='Task.user_id',
        lazy=True
    )
    teams = db.relationship('UserTeam', back_populates='user') 

    @property
    def managed_teams(self):
        # retorna só os times que esse usuário gerencia
        return [assoc.team for assoc in self.teams if assoc.is_manager]

    def has_permission(self, permission):
        if self.is_admin:  # admin geralmente tem tudo
            return True

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_admin': self.is_admin,
            'is_active': self.is_active,
            # Lista das equipes desse usuário com info se ele é manager
            'equipes': [
                {
                    'id': assoc.team.id,
                    'name': assoc.team.name,
                    'is_manager': assoc.is_manager
                }
                for assoc in self.teams
            ],
            # Para facilitar, um boolean que indica se o user é manager de alguma equipe
            'is_manager': any(assoc.is_manager for assoc in self.teams)
        }
