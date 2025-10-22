from extensions import db
from datetime import datetime, timedelta
import uuid

class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref=db.backref("password_reset_tokens", lazy="dynamic"))

    @staticmethod
    def generate(user_id: int, ttl_minutes: int = 60):
        t = PasswordResetToken(
            user_id=user_id,
            token=uuid.uuid4().hex,
            expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes)
        )
        db.session.add(t)
        return t

    def is_valid(self) -> bool:
        return self.used_at is None and datetime.utcnow() < self.expires_at
