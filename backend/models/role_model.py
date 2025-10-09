from extensions import db
from sqlalchemy.ext.associationproxy import association_proxy

class Role(db.Model):
    __tablename__ = 'roles'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)

    # Relação primária via objeto de associação
    users_link = db.relationship(
        'UserRole',
        back_populates='role',
        cascade='all, delete-orphan',
        passive_deletes=True
    )
    # Proxy apenas leitura/escrita de conveniência
    users = association_proxy('users_link', 'user')

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'description': self.description}