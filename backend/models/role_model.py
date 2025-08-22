from extensions import db

class Role(db.Model):
    __tablename__ = 'roles'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)

    # Relacionamento inverso
    users = db.relationship('User', secondary='user_roles', back_populates='roles')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }
