# backend/models/task_model.py

from extensions import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='pending')  # ou 'done'
    due_date = db.Column(db.DateTime, nullable=True)

    # 🆕 Novos campos
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

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user = db.relationship('User', back_populates='tasks')

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "due_date": self.due_date,
            "prioridade": self.prioridade,
            "categoria": self.categoria,
            "status_inicial": self.status_inicial,
            "tempo_estimado": self.tempo_estimado,
            "tempo_unidade": self.tempo_unidade,
            "relacionado_a": self.relacionado_a,
            "lembretes": self.lembretes,
            "tags": self.tags,
            "anexos": self.anexos,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "user_id": self.user_id,
        }
