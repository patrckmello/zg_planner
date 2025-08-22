from extensions import db

class UserTeam(db.Model):
    __tablename__ = 'user_teams'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'))
    is_manager = db.Column(db.Boolean, default=False)

    user = db.relationship('User', back_populates='teams')
    team = db.relationship('Team', back_populates='members')
    
