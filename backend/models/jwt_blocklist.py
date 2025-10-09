from extensions import db
from datetime import datetime, timezone

class JWTBlocklist(db.Model):
    __tablename__ = 'jwt_blocklist'
    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), unique=True, index=True, nullable=False)
    revoked_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
