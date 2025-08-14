from extensions import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import JSON

class Task(db.Model):
    __tablename__ = 'tasks'  # Definindo explicitamente o nome da tabela
    
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
    lembretes = db.Column(JSON, default=list)
    tags = db.Column(JSON, default=list)
    anexos = db.Column(JSON, default=list)

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
    collaborators = db.Column(JSON, default=list) # Array de IDs de Usuários
    
    # Lista de usuários atribuídos/responsáveis (IDs de usuários)
    assigned_users = db.Column(JSON, default=list) # Array de IDs de Usuários responsáveis

    # Equipe relacionada à tarefa
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=True)
    team = db.relationship('Team', backref='tasks')

    def to_dict(self):
        from models.user_model import User
        
        # Buscar informações dos usuários atribuídos
        assigned_users_info = []
        if self.assigned_users:
            for user_id in self.assigned_users:
                user = User.query.get(user_id)
                if user:
                    assigned_users_info.append({
                        "id": user.id,
                        "name": user.username,
                        "username": user.username,
                        "email": user.email
                    })
        
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
            "user": {
                "id": self.user.id,
                "name": self.user.username,  # Usando username como name
                "username": self.user.username,
                "email": self.user.email
            } if self.user else None,
            "assigned_by_user_id": self.assigned_by_user_id,
            "assigned_by_user": {
                "id": self.assigned_by_user.id,
                "name": self.assigned_by_user.username,  # Usando username como name
                "username": self.assigned_by_user.username,
                "email": self.assigned_by_user.email
            } if self.assigned_by_user else None,
            "assigned_to_user": {
                "id": self.user.id,
                "name": self.user.username,  # Usando username como name
                "username": self.user.username,
                "email": self.user.email
            } if self.user else None,
            "collaborators": self.collaborators,
            "assigned_users": self.assigned_users,
            "assigned_users_info": assigned_users_info,
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
        
        # Usuários atribuídos à tarefa
        if user.id in (self.assigned_users or []):
            return True
        
        # Colaboradores/observadores
        if user.id in (self.collaborators or []):
            return True
        
        if self.team_id:
            team_member_ids = [assoc.team_id for assoc in user.teams]
            if self.team_id in team_member_ids:
                return True
        
        return False

