from extensions import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='pending')
    due_date = db.Column(db.DateTime, nullable=True)

    prioridade = db.Column(db.String(20))  # Alta, Média, Baixa
    categoria = db.Column(db.String(50))   # Processo, Reunião, etc
    status_inicial = db.Column(db.String(50))  # A fazer, Em andamento, etc
    tempo_estimado = db.Column(db.Integer)     # número (ex: 2)
    tempo_unidade = db.Column(db.String(10))   # 'horas' ou 'minutos'
    relacionado_a = db.Column(db.String(200))  # texto livre
    lembretes = db.Column(JSONB, default=list)
    tags = db.Column(JSONB, default=list)
    anexos = db.Column(JSONB, default=list)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Usuário responsável pela tarefa (quem vai executar)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user = db.relationship(
        'User',
        back_populates='tasks',
        foreign_keys=[user_id]
    )

    # Usuário que atribuiu a tarefa (gestor)
    assigned_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_by_user = db.relationship('User', foreign_keys=[assigned_by_user_id])

    # Lista de colaboradores/observadores (IDs de usuários)
    collaborators = db.Column(JSONB, default=list) # Array de IDs de Usuários

    # Equipe relacionada à tarefa
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=True)
    team = db.relationship('Team', backref='tasks')

    def to_dict(self):
        return {
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
            "user_username": self.user.username if self.user else None,
            "assigned_by_user_id": self.assigned_by_user_id,
            "assigned_by_username": self.assigned_by_user.username if self.assigned_by_user else None,
            "collaborators": self.collaborators,
            "team_id": self.team_id,
            "team_name": self.team.name if self.team else None
        }

    def can_be_assigned_by(self, user):
        """Verifica se um usuário pode atribuir esta tarefa"""
        # Admin pode atribuir qualquer tarefa
        if user.is_admin:
            return True
        
        # Se a tarefa tem uma equipe, verifica se o usuário é gestor da equipe
        if self.team_id:
            return any(
                assoc.is_manager and assoc.team_id == self.team_id 
                for assoc in user.teams
            )
        
        # Para tarefas pessoais, apenas o próprio usuário pode atribuir
        return self.user_id == user.id

    def can_be_viewed_by(self, user):
        """Verifica se um usuário pode visualizar esta tarefa"""
        # Admin pode ver tudo
        if user.is_admin:
            return True
        
        # Responsável pela tarefa
        if self.user_id == user.id:
            return True
        
        # Quem atribuiu a tarefa
        if self.assigned_by_user_id == user.id:
            return True
        
        # Colaboradores/observadores
        if user.id in (self.collaborators or []):
            return True
        
        # Membros da equipe (se a tarefa pertence a uma equipe)
        if self.team_id:
            user_team_ids = [assoc.team_id for assoc in user.teams]
            if self.team_id in user_team_ids:
                return True
        
        # Gestores podem ver tarefas de suas equipes
        manager_team_ids = [
            assoc.team_id for assoc in user.teams if assoc.is_manager
        ]
        if self.team_id in manager_team_ids:
            return True
        
        return False

