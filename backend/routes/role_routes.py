from flask import Blueprint, request, jsonify
from models.role_model import Role
from extensions import db
from decorators import admin_required

role_bp = Blueprint('role_bp', __name__, url_prefix='/api/roles')

@role_bp.route('', methods=['GET']) 
@admin_required
def list_roles():
    roles = Role.query.all()
    roles_with_count = []
    for role in roles:
        role_dict = role.to_dict()
        role_dict['users_count'] = len(role.users)
        roles_with_count.append(role_dict)
    return jsonify(roles_with_count)

@role_bp.route('', methods=['POST'])
@admin_required
def create_role():
    data = request.json
    if Role.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Role já existe'}), 400

    role = Role(
        name=data['name'],
        description=data.get('description')
    )
    db.session.add(role)
    db.session.commit()
    return jsonify(role.to_dict()), 201

@role_bp.route('/<int:role_id>', methods=['PUT'])
@admin_required
def update_role(role_id):
    role = Role.query.get_or_404(role_id)
    data = request.json
    new_name = data.get('name', role.name)

    # Valida se o novo nome já existe em outra role
    existing = Role.query.filter(Role.name == new_name, Role.id != role_id).first()
    if existing:
        return jsonify({'error': 'Já existe um cargo com esse nome'}), 400

    role.name = new_name
    role.description = data.get('description', role.description)
    db.session.commit()
    return jsonify(role.to_dict())

@role_bp.route('/<int:role_id>', methods=['DELETE'])
@admin_required
def delete_role(role_id):
    role = Role.query.get_or_404(role_id)
    db.session.delete(role)
    db.session.commit()
    return jsonify({'message': 'Role excluída com sucesso'})

@role_bp.route('/<int:role_id>/users', methods=['GET'])
@admin_required
def get_role_users(role_id):
    """Busca todos os usuários que possuem um cargo específico"""
    role = Role.query.get_or_404(role_id)
    users = [user.to_dict() for user in role.users]
    return jsonify({
        'role': role.to_dict(),
        'users': users
    })

@role_bp.route('/<int:role_id>/users/<int:user_id>', methods=['POST'])
@admin_required
def add_user_to_role(role_id, user_id):
    """Adiciona um usuário a um cargo"""
    from models.user_model import User
    from flask_jwt_extended import get_jwt_identity
    from models.audit_log_model import AuditLog
    
    role = Role.query.get_or_404(role_id)
    user = User.query.get_or_404(user_id)
    
    # Verifica se o usuário já possui essa role
    if role in user.roles:
        return jsonify({'error': 'Usuário já possui esse cargo'}), 400
    
    user.roles.append(role)
    db.session.commit()
    
    # Log da ação
    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE',
        description=f'Adicionou usuário "{user.username}" ao cargo "{role.name}"',
        resource_type='role',
        resource_id=role_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify({
        'role': role.to_dict(),
        'users': [u.to_dict() for u in role.users]
    })

@role_bp.route('/<int:role_id>/users/<int:user_id>', methods=['DELETE'])
@admin_required
def remove_user_from_role(role_id, user_id):
    """Remove um usuário de um cargo"""
    from models.user_model import User
    from flask_jwt_extended import get_jwt_identity
    from models.audit_log_model import AuditLog
    
    role = Role.query.get_or_404(role_id)
    user = User.query.get_or_404(user_id)
    
    # Verifica se o usuário possui essa role
    if role not in user.roles:
        return jsonify({'error': 'Usuário não possui esse cargo'}), 400
    
    user.roles.remove(role)
    db.session.commit()
    
    # Log da ação
    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE',
        description=f'Removeu usuário "{user.username}" do cargo "{role.name}"',
        resource_type='role',
        resource_id=role_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify({
        'role': role.to_dict(),
        'users': [u.to_dict() for u in role.users]
    })

