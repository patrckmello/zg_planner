from flask import Blueprint, request, jsonify
from models.role_model import Role
from models.user_model import User
from models.user_role_model import UserRole
from extensions import db
from decorators import admin_required
from models.audit_log_model import AuditLog
from flask_jwt_extended import get_jwt_identity
from sqlalchemy.exc import IntegrityError

role_bp = Blueprint("role_bp", __name__, url_prefix="/api/roles")

@role_bp.route("", methods=["GET"])
@admin_required
def list_roles():
    roles = Role.query.all()
    payload = []
    for role in roles:
        r = role.to_dict()
        r["users_count"] = len(role.users_link)  # usa o link (robusto)
        payload.append(r)
    return jsonify(payload)

@role_bp.route("", methods=["POST"])
@admin_required
def create_role():
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "O nome do cargo é obrigatório"}), 400

    if Role.query.filter_by(name=name).first():
        return jsonify({"error": "Role já existe"}), 400

    role = Role(name=name, description=data.get("description"))
    db.session.add(role)
    db.session.commit()

    AuditLog.log_action(
        user_id=get_jwt_identity(),
        action='CREATE',
        description=f'Criou cargo: {role.name}',
        resource_type='role',
        resource_id=role.id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    return jsonify(role.to_dict()), 201

@role_bp.route("/<int:role_id>", methods=["PUT"])
@admin_required
def update_role(role_id):
    role = Role.query.get_or_404(role_id)
    data = request.json or {}

    new_name = (data.get("name") or role.name).strip()
    if Role.query.filter(Role.id != role_id, Role.name == new_name).first():
        return jsonify({"error": "Já existe um cargo com esse nome"}), 400

    old_name = role.name
    role.name = new_name
    role.description = data.get("description", role.description)
    db.session.commit()

    AuditLog.log_action(
        user_id=get_jwt_identity(),
        action='UPDATE',
        description=f'Atualizou cargo: {old_name} para {role.name}',
        resource_type='role',
        resource_id=role.id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    return jsonify(role.to_dict())

@role_bp.route("/<int:role_id>", methods=["DELETE"])
@admin_required
def delete_role(role_id):
    role = Role.query.get_or_404(role_id)
    role_name = role.name
    db.session.delete(role)
    db.session.commit()

    AuditLog.log_action(
        user_id=get_jwt_identity(),
        action='DELETE',
        description=f'Excluiu cargo: {role_name}',
        resource_type='role',
        resource_id=role_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    return jsonify({"message": "Role excluída com sucesso"})

@role_bp.route("/<int:role_id>/users", methods=["GET"])
@admin_required
def get_role_users(role_id):
    role = Role.query.get_or_404(role_id)
    users = [
        {
            "id": link.user.id,
            "username": link.user.username,
            "email": link.user.email,
        }
        for link in role.users_link
        if link.user is not None
    ]
    return jsonify(users)

@role_bp.route("/<int:role_id>/users/<int:user_id>", methods=["POST"])
@admin_required
def add_user_to_role(role_id, user_id):
    role = Role.query.get_or_404(role_id)
    user = User.query.get_or_404(user_id)

    # checagem otimista
    exists = UserRole.query.filter_by(user_id=user.id, role_id=role.id).first()
    if exists:
        return jsonify({"error": "Usuário já possui esse cargo"}), 400

    db.session.add(UserRole(user_id=user.id, role_id=role.id))
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Usuário já possui esse cargo"}), 409

    AuditLog.log_action(
        user_id=get_jwt_identity(),
        action='UPDATE',
        description=f'Adicionou usuário "{user.username}" ao cargo "{role.name}"',
        resource_type='role',
        resource_id=role_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

    users = [
        {"id": l.user.id, "username": l.user.username, "email": l.user.email}
        for l in role.users_link if l.user is not None
    ]
    return jsonify({"role": role.to_dict(), "users": users}), 201

@role_bp.route("/<int:role_id>/users/<int:user_id>", methods=["DELETE"])
@admin_required
def remove_user_from_role(role_id, user_id):
    role = Role.query.get_or_404(role_id)
    user = User.query.get_or_404(user_id)

    link = UserRole.query.filter_by(user_id=user.id, role_id=role.id).first()
    if not link:
        return jsonify({"error": "Usuário não possui esse cargo"}), 400

    db.session.delete(link)
    db.session.commit()

    AuditLog.log_action(
        user_id=get_jwt_identity(),
        action='UPDATE',
        description=f'Removeu usuário "{user.username}" do cargo "{role.name}"',
        resource_type='role',
        resource_id=role_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

    users = [
        {"id": l.user.id, "username": l.user.username, "email": l.user.email}
        for l in role.users_link if l.user is not None
    ]
    return jsonify({"role": role.to_dict(), "users": users})
