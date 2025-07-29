from extensions import db
from datetime import datetime

class Team(db.Model):
    __tablename__ = 'teams'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    members = db.relationship('UserTeam', back_populates='team', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "members": [
                {
                    "user_id": ut.user.id,
                    "username": ut.user.username,
                    "email": ut.user.email,
                    "is_manager": ut.is_manager
                }
                for ut in self.members
            ]
        }