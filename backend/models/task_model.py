from extensions import db
from datetime import datetime
from sqlalchemy import JSON
from sqlalchemy.orm import validates
from sqlalchemy import Text

class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)

    status = db.Column(db.String(20), default='pending', index=True)
    due_date = db.Column(db.DateTime, nullable=True)

    completed_at = db.Column(db.DateTime, nullable=True, index=True)
    archived_at  = db.Column(db.DateTime, nullable=True, index=True)

    # quem arquivou (manual). Para auto-arquivo (scheduler), pode ficar None ou um "system user"
    archived_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    archived_by_user = db.relationship('User', foreign_keys=[archived_by_user_id])
    requires_approval = db.Column(db.Boolean, nullable=False, default=False, index=True)
    approval_status = db.Column(db.String(20), nullable=True, index=True)  # None | "pending" | "approved" | "rejected"
    approved_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_by_user = db.relationship('User', foreign_keys=[approved_by_user_id])
    approved_at = db.Column(db.DateTime, nullable=True, index=True)

    prioridade = db.Column(db.String(20))
    categoria = db.Column(db.String(50))
    status_inicial = db.Column(db.String(50))
    tempo_estimado = db.Column(db.Integer)
    tempo_unidade = db.Column(db.String(10))
    relacionado_a = db.Column(db.String(200))
    lembretes = db.Column(JSON, default=list)
    tags = db.Column(JSON, default=list)
    subtasks = db.Column(JSON, default=list)
    anexos = db.Column(JSON, default=list)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # --- Soft delete ---
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)
    deleted_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user = db.relationship('User', back_populates='tasks', foreign_keys=[user_id])

    assigned_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_by_user = db.relationship('User', foreign_keys=[assigned_by_user_id])

    deleted_by_user = db.relationship('User', foreign_keys=[deleted_by_user_id])

    collaborators = db.Column(JSON, default=list)
    assigned_users = db.Column(JSON, default=list)

    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=True)
    team = db.relationship('Team', backref='tasks')

    ms_event_id    = db.Column(db.String(512)) 
    ms_calendar_id = db.Column(db.String(128))    # default "primary"
    ms_event_etag  = db.Column(db.String(256))    # pra If-Match
    ms_last_sync   = db.Column(db.DateTime,    nullable=True)
    ms_sync_status = db.Column(db.String(32))    # "ok","error","deleted"

    @validates('approval_status')
    def _validate_approval_status(self, key, value):
        if value is None:
            return None
        allowed = {'pending', 'approved', 'rejected'}
        if value not in allowed:
            raise ValueError(f"approval_status inválido: {value}")
        return value

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self, user_id: int | None):
        self.deleted_at = datetime.utcnow()
        self.deleted_by_user_id = user_id

    def restore(self):
        self.deleted_at = None
        self.deleted_by_user_id = None

    # Helpers de status
    def requires_manager_approval(self) -> bool:
        return bool(self.requires_approval)

    def is_approval_pending(self) -> bool:
        return self.requires_manager_approval() and self.approval_status == 'pending'

    def is_approved(self) -> bool:
        return self.requires_manager_approval() and self.approval_status == 'approved'

    def is_rejected(self) -> bool:
        return self.requires_manager_approval() and self.approval_status == 'rejected'

    def submit_for_approval(self):
        if not self.requires_manager_approval():
            # se não precisa de aprovação, não muda nada
            return
        self.approval_status = 'pending'
        self.approved_by_user_id = None
        self.approved_at = None

    def set_approved(self, approver_user_id: int):
        self.approval_status = 'approved'
        self.approved_by_user_id = approver_user_id
        self.approved_at = datetime.utcnow()

    def set_rejected(self, approver_user_id: int):
        self.approval_status = 'rejected'
        self.approved_by_user_id = approver_user_id
        self.approved_at = datetime.utcnow()

    def mark_done(self):
        # normaliza status
        self.status = 'done'

        # precisa aprovação?
        if self.requires_manager_approval() and not self.is_approved():
            raise ValueError("Tarefa requer aprovação do gestor antes de ser concluída.")

        # BLOQUEIO POR SUBTASK
        if not self.can_finish():
            raise ValueError("Conclua todas as subtarefas antes de finalizar a tarefa.")

        if not self.completed_at:
            self.completed_at = datetime.utcnow()
        # ao concluir, a tarefa não está arquivada
        self.archived_at = None
        self.archived_by_user_id = None

    def mark_archived(self, archived_by_user_id=None):
        self.status = 'archived'
        now = datetime.utcnow()
        if not self.archived_at:
            self.archived_at = now
        if not self.completed_at:
            self.completed_at = now  # opcional: considerar concluída ao arquivar
        self.archived_by_user_id = archived_by_user_id

    def unarchive(self, new_status='pending'):
        self.status = new_status
        self.archived_at = None
        self.archived_by_user_id = None

    def to_dict(self):
        from models.user_model import User

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

        deleted_by_user_info = None
        if self.deleted_by_user:
            deleted_by_user_info = {
                "id": self.deleted_by_user.id,
                "name": self.deleted_by_user.username,
                "username": self.deleted_by_user.username,
                "email": self.deleted_by_user.email,
            }

        archived_by_user_info = None
        if self.archived_by_user:
            archived_by_user_info = {
                "id": self.archived_by_user.id,
                "name": self.archived_by_user.username,
                "username": self.archived_by_user.username,
                "email": self.archived_by_user.email,
            }

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,

            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "archived_at":  self.archived_at.isoformat() if self.archived_at else None,
            "archived_by_user_id": self.archived_by_user_id,
            "archived_by_user": archived_by_user_info,

            "prioridade": self.prioridade,
            "categoria": self.categoria,
            "status_inicial": self.status_inicial,
            "tempo_estimado": self.tempo_estimado,
            "tempo_unidade": self.tempo_unidade,
            "relacionado_a": self.relacionado_a,
            "lembretes": self.lembretes or [],
            "tags": self.tags or [],
            "anexos": self.anexos or [],
            # --- subtarefas ---
            "subtasks": self.subtasks or [],
            "subtasks_total": self.subtask_counts().get("total"),
            "subtasks_done": self.subtask_counts().get("done"),
            "subtasks_percent": self.subtask_counts().get("percent"),
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

            # --- aprovação ---
            "requires_approval": bool(self.requires_approval),
            "approval_status": self.approval_status,
            "approved_by_user_id": self.approved_by_user_id,
            "approved_by_user": {
                "id": self.approved_by_user.id,
                "name": self.approved_by_user.username,
                "username": self.approved_by_user.username,
                "email": self.approved_by_user.email
            } if self.approved_by_user else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,

            "team_id": self.team_id,
            "team_name": self.team.name if self.team else None,

            "is_deleted": bool(self.is_deleted),
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "deleted_by_user_id": self.deleted_by_user_id,
            "deleted_by_user": deleted_by_user_info,
            "ms_event_id": self.ms_event_id,
            "ms_calendar_id": self.ms_calendar_id,
            "ms_last_sync": self.ms_last_sync.isoformat() if self.ms_last_sync else None,
            "ms_sync_status": self.ms_sync_status,
        }

    def can_be_assigned_by(self, user):
        if user.is_admin:
            return True
        if self.team_id:
            return any(assoc.is_manager and assoc.team_id == self.team_id for assoc in user.teams)
        return self.user_id == user.id

    def can_be_viewed_by(self, user):
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

    def _coerce_subtasks(self):
        """Normaliza estrutura de subtarefas (ids, tipos e ordenação)."""
        norm = []
        for i, st in enumerate(self.subtasks or []):
            if not isinstance(st, dict):
                continue
            st_id = st.get("id") or f"st-{self.id}-{i+1}"
            title = (st.get("title") or "").strip()
            if not title:
                continue
            norm.append({
                "id": st_id,
                "title": title,
                "done": bool(st.get("done", False)),
                "assignee_id": st.get("assignee_id"),
                "due_date": st.get("due_date"),
                "required": bool(st.get("required", False)),
                "weight": int(st.get("weight", 1)),
                "order": int(st.get("order", i)),
            })
        self.subtasks = sorted(norm, key=lambda x: x["order"])

    def subtask_counts(self):
        self._coerce_subtasks()
        total = len(self.subtasks or [])
        done = sum(1 for s in (self.subtasks or []) if s.get("done"))
        total_w = sum(max(1, int(s.get("weight", 1))) for s in (self.subtasks or [])) or 0
        done_w = sum(max(1, int(s.get("weight", 1))) for s in (self.subtasks or []) if s.get("done"))
        percent = int(round((done_w / total_w) * 100)) if total_w else 0
        return {"total": total, "done": done, "percent": percent, "total_weight": total_w, "done_weight": done_w}

    def all_subtasks_done(self):
        self._coerce_subtasks()
        return all(s.get("done") for s in (self.subtasks or []))

    def can_finish(self):
        """Regra simples: só conclui se TODAS as subtasks estiverem 'done'."""
        return self.all_subtasks_done()
