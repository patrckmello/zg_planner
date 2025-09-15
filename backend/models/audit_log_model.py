from extensions import db
from datetime import datetime
import json

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    resource_type = db.Column(db.String(50), nullable=True)
    resource_id = db.Column(db.Integer, nullable=True)
    description = db.Column(db.Text, nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='audit_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'description': self.description,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_name': self.user.username if self.user else 'Sistema'
        }

    @staticmethod
    def log_action(
        user_id,
        action,
        description,
        resource_type=None,
        resource_id=None,
        ip_address=None,
        user_agent=None,
        **kwargs
    ):
        try:
            before = kwargs.get('before')
            after = kwargs.get('after')
            changes = kwargs.get('changes')

            # SE já temos 'changes' formatado no description, NÃO anexar snapshot JSON
            if not changes and (before is not None or after is not None):
                snapshot = {
                    'before': before if isinstance(before, (dict, list)) else str(before),
                    'after':  after  if isinstance(after,  (dict, list)) else str(after),
                }
                snap_str = json.dumps(snapshot, ensure_ascii=False)[:1000]
                description = f"{description}\n\n[DIFF]\n{snap_str}"
        except Exception:
            pass

        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(log)
        db.session.commit()
        return log
