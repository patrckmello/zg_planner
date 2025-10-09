from extensions import db

class UserTeam(db.Model):
    __tablename__ = 'user_teams'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id', ondelete="CASCADE"), nullable=False)
    is_manager = db.Column(db.Boolean, default=False, nullable=False)

    user = db.relationship('User', back_populates='teams')
    team = db.relationship('Team', back_populates='members')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'team_id', name='uq_user_team'),
    )