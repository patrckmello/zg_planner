from extensions import db
from datetime import datetime
from sqlalchemy import JSON

class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='pending')
    due_date = db.Column(db.DateTime, nullable=True)

    prioridade = db.Column(db.String(20))        # Alta, Média, Baixa
    categoria = db.Column(db.String(50))         # Processo, Reunião, etc
    status_inicial = db.Column(db.String(50))    # A fazer, Em andamento, etc
    tempo_estimado = db.Column(db.Integer)       # número (ex: 2)
    tempo_unidade = db.Column(db.String(10))     # 'horas' ou 'minutos'
    relacionado_a = db.Column(db.String(200))    # texto livre
    lembretes = db.Column(JSON, default=list)
    tags = db.Column(JSON, default=list)
    anexos = db.Column(JSON, default=list)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # --- Soft delete ---
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)
    deleted_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Usuário responsável (executor principal)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user = db.relationship('User', back_populates='tasks', foreign_keys=[user_id])

    # Usuário que atribuiu (gestor)
    assigned_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_by_user = db.relationship('User', foreign_keys=[assigned_by_user_id])

    # Usuário que moveu para lixeira
    deleted_by_user = db.relationship('User', foreign_keys=[deleted_by_user_id])

    # Listas
    collaborators = db.Column(JSON, default=list)
    assigned_users = db.Column(JSON, default=list)

    # Equipe relacionada
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=True)
    team = db.relationship('Team', backref='tasks')

    # -------- Soft delete helpers --------
    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self, user_id: int | None):
        self.deleted_at = datetime.utcnow()
        self.deleted_by_user_id = user_id

    def restore(self):
        self.deleted_at = None
        self.deleted_by_user_id = None
    # -------------------------------------

    def to_dict(self):
        from models.user_model import User

        # Buscar informações dos usuários atribuídos
        assigned_users_info = []
        if self.assigned_users:
            for uid in self.assigned_users:
                u = User.query.get(uid)
                if u:
                    assigned_users_info.append({
                        "id": u.id,
                        "name": u.username,
                        "username": u.username,
                        "email": u.email
                    })

        # Buscar informações dos colaboradores
        collaborators_info = []
        if self.collaborators:
            for uid in self.collaborators:
                u = User.query.get(uid)
                if u:
                    collaborators_info.append({
                        "id": u.id,
                        "name": u.username,
                        "username": u.username,
                        "email": u.email
                    })

        result = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "prioridade": self.prioridade,
            "categoria": self.categoria,
            "status_inicial": self.status_inicial,
            "tempo_estimado": self.tempo_estimado,
            "tempo_unidade": self.tempo_unidade,
            "relacionado_a": self.relacionado_a,
            "lembretes": self.lembretes,
            "tags": self.tags,
            "anexos": self.anexos,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,

            "user_id": self.user_id,
            "user": {
                "id": self.user.id,
                "name": self.user.username,
                "username": self.user.username,
                "email": self.user.email
            } if self.user else None,

            "assigned_by_user_id": self.assigned_by_user_id,
            "assigned_by_user": {
                "id": self.assigned_by_user.id,
                "name": self.assigned_by_user.username,
                "username": self.assigned_by_user.username,
                "email": self.assigned_by_user.email
            } if self.assigned_by_user else None,

            "assigned_to_user": {
                "id": self.user.id,
                "name": self.user.username,
                "username": self.user.username,
                "email": self.user.email
            } if self.user else None,

            "collaborators": self.collaborators or [],
            "collaborators_info": collaborators_info,
            "assigned_users": self.assigned_users or [],
            "assigned_users_info": assigned_users_info,

            "team_id": self.team_id,
            "team_name": self.team.name if self.team else None,

            # Metadados da lixeira
            "is_deleted": self.is_deleted,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "deleted_by_user_id": self.deleted_by_user_id
        }

        return result

    def can_be_assigned_by(self, user):
        """Verifica se um usuário pode atribuir esta tarefa."""
        if user.is_admin:
            return True
        if self.team_id:
            return any(assoc.is_manager and assoc.team_id == self.team_id for assoc in user.teams)
        return self.user_id == user.id

    def can_be_viewed_by(self, user):
        """Verifica se um usuário pode visualizar esta tarefa."""
        if user.is_admin:
            return True
        if self.user_id == user.id:
            return True
        if self.assigned_by_user_id == user.id:
            return True
        if user.id in (self.assigned_users or []):
            return True
        if user.id in (self.collaborators or []):
            return True
        if self.team_id:
            team_member_ids = [assoc.team_id for assoc in user.teams]
            if self.team_id in team_member_ids:
                return True
        return False
