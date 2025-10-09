# models/user_model.py
from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from sqlalchemy.ext.associationproxy import association_proxy

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    icon_color = db.Column(db.String(7), default='#3498db')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    roles_link = db.relationship(
        'UserRole',
        back_populates='user',
        cascade='all, delete-orphan',
        passive_deletes=True
    )
    roles = association_proxy('roles_link', 'role')

    tasks = db.relationship(
        'Task',
        back_populates='user',
        foreign_keys='Task.user_id',
        lazy=True
    )
    teams = db.relationship('UserTeam', back_populates='user')

    @property
    def managed_teams(self):
        return [assoc.team for assoc in self.teams if assoc.is_manager]

    def has_permission(self, permission):
        if self.is_admin:
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
            'icon_color': self.icon_color,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'equipes': [
                {
                    'id': assoc.team.id,
                    'name': assoc.team.name,
                    'is_manager': assoc.is_manager
                }
                for assoc in self.teams
            ],
            'is_manager': any(assoc.is_manager for assoc in self.teams),
            # Agora roles vem do association_proxy (objetos Role); se quiser enviar simplificado:
            'roles': [ {'id': r.id, 'name': r.name, 'description': r.description} for r in self.roles ]
        }
