from extensions import db
from datetime import datetime

class UserIntegration(db.Model):
    __tablename__ = "user_integrations"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True, nullable=False)
    provider = db.Column(db.String(50), index=True, nullable=False, default="microsoft")
    provider_user_id = db.Column(db.String(120), index=True)  # oid do Entra ID
    email = db.Column(db.String(255), index=True)
    display_name = db.Column(db.String(255))

    access_token = db.Column(db.Text)
    refresh_token = db.Column(db.Text)
    expires_at = db.Column(db.DateTime)  # UTC
    scopes = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'provider', name='uq_user_provider'),)
