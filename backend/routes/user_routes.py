from flask import Blueprint, request, jsonify
from models.user_model import User
from models.audit_log_model import AuditLog
from extensions import db
from decorators import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
import re

from models.task_model import Task

user_bp = Blueprint('user_bp', __name__, url_prefix='/api/users')

@user_bp.route('/me')
@jwt_required()
def get_me():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404
    return jsonify(user.to_dict())

@user_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404
    
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({"error": "Senha atual e nova senha são obrigatórias"}), 400
    
    # Verificar senha atual
    if not user.check_password(current_password):
        return jsonify({"error": "Senha atual incorreta"}), 400
    
    # Validar nova senha
    if len(new_password) < 6:
        return jsonify({"error": "A nova senha deve ter pelo menos 6 caracteres"}), 400
    
    # Atualizar senha
    user.set_password(new_password)
    db.session.commit()
    
    # Log da ação
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE',
        description='Usuário alterou sua senha',
        resource_type='user',
        resource_id=current_user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify({"message": "Senha alterada com sucesso"})

@user_bp.route('/update-icon-color', methods=['PUT'])
@jwt_required()
def update_icon_color():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404
    
    data = request.get_json()
    icon_color = data.get('icon_color')
    
    if not icon_color:
        return jsonify({"error": "Cor do ícone é obrigatória"}), 400
    
    # Validar formato da cor (hex)
    if not re.match(r'^#[0-9A-Fa-f]{6}$', icon_color):
        return jsonify({"error": "Formato de cor inválido. Use formato hex (#RRGGBB)"}), 400
    
    # Atualizar cor
    user.icon_color = icon_color
    db.session.commit()
    
    # Log da ação
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE',
        description=f'Usuário alterou a cor do ícone para {icon_color}',
        resource_type='user',
        resource_id=current_user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify({"message": "Cor do ícone atualizada com sucesso"})

@user_bp.route('', methods=['GET'])
@jwt_required()
def list_users():
    """Lista usuários com paginação e busca por nome"""
    try:
        # Parâmetros de paginação
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Parâmetro de busca por nome
        search = request.args.get('search', '').strip()
        
        # Construir query base
        query = User.query
        
        # Aplicar filtro de busca se fornecido
        if search:
            # Busca por username ou email (case-insensitive)
            search_filter = f"%{search}%"
            query = query.filter(
                db.or_(
                    User.username.ilike(search_filter),
                    User.email.ilike(search_filter)
                )
            )
        
        # Ordenar por username
        query = query.order_by(User.username.asc())
        
        # Aplicar paginação
        users_pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Preparar resposta com usuários e metadados de paginação
        response_data = {
            "items": [user.to_dict() for user in users_pagination.items],
            "pagination": {
                "total_items": users_pagination.total,
                "total_pages": users_pagination.pages,
                "current_page": users_pagination.page,
                "per_page": users_pagination.per_page,
                "has_next": users_pagination.has_next,
                "has_prev": users_pagination.has_prev,
                "next_num": users_pagination.next_num,
                "prev_num": users_pagination.prev_num
            },
            "search": search
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_bp.route('/', methods=['POST'])
@admin_required
def create_user():
    data = request.json
    user = User(
        username=data['username'],
        email=data['email'],
        is_admin=data.get('is_admin', False)
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    # Log da ação
    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='CREATE',
        description=f'Criou usuário: {user.username}',
        resource_type='user',
        resource_id=user.id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify(user.to_dict()), 201

@user_bp.route('/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    user.username = data.get('username', user.username)
    user.email = data.get('email', user.email)
    user.is_admin = data.get('is_admin', user.is_admin)
    user.is_active = data.get('is_active', user.is_active)

    db.session.commit()
    
    # Log da ação
    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE',
        description=f'Atualizou usuário: {user.username}',
        resource_type='user',
        resource_id=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify(user.to_dict())

@user_bp.route('/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    
    # Verifica tasks ativas
    active_tasks = Task.query.filter(
        Task.user_id == user.id,
        Task.status.in_(["pending", "in_progress"])
    ).count()
    
    if active_tasks > 0:
        return jsonify({
            "error": "Usuário não pode ser excluído. Possui tasks ativas."
        }), 400

    username = user.username
    db.session.delete(user)
    db.session.commit()
    
    # Log da ação
    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='DELETE',
        description=f'Excluiu usuário: {username}',
        resource_type='user',
        resource_id=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify({'message': 'Usuário excluído com sucesso.'})


@user_bp.route('/<int:user_id>/roles', methods=['POST'])
@admin_required
def add_role_to_user(user_id):
    """Adiciona uma role a um usuário"""
    from models.role_model import Role
    
    user = User.query.get_or_404(user_id)
    data = request.json
    role_id = data.get('role_id')
    
    if not role_id:
        return jsonify({'error': 'role_id é obrigatório'}), 400
    
    role = Role.query.get_or_404(role_id)
    
    # Verifica se o usuário já possui essa role
    if role in user.roles:
        return jsonify({'error': 'Usuário já possui essa role'}), 400
    
    user.roles.append(role)
    db.session.commit()
    
    # Log da ação
    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE',
        description=f'Adicionou role "{role.name}" ao usuário {user.username}',
        resource_type='user',
        resource_id=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify(user.to_dict())

@user_bp.route('/<int:user_id>/roles/<int:role_id>', methods=['DELETE'])
@admin_required
def remove_role_from_user(user_id, role_id):
    """Remove uma role de um usuário"""
    from models.role_model import Role
    
    user = User.query.get_or_404(user_id)
    role = Role.query.get_or_404(role_id)
    
    # Verifica se o usuário possui essa role
    if role not in user.roles:
        return jsonify({'error': 'Usuário não possui essa role'}), 400
    
    user.roles.remove(role)
    db.session.commit()
    
    # Log da ação
    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE',
        description=f'Removeu role "{role.name}" do usuário {user.username}',
        resource_type='user',
        resource_id=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify(user.to_dict())

