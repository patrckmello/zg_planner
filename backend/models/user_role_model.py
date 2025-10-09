from extensions import db

class UserRole(db.Model):
    __tablename__ = "user_roles"

    # Use PK composta para casar com a tabela existente
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)

    user = db.relationship("User", back_populates="roles_link")
    role = db.relationship("Role", back_populates="users_link")

    def __repr__(self):
        return f"<UserRole user_id={self.user_id} role_id={self.role_id}>"
