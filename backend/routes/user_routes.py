from flask import Blueprint, request, jsonify
from models.user_model import User
from models.audit_log_model import AuditLog
from extensions import db
from decorators import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
import re

from models.task_model import Task

# ADD: imports necessários para roles e equipes
from models.role_model import Role
from models.user_role_model import UserRole
from models.team_model import Team
from models.user_team_model import UserTeam
from sqlalchemy.exc import IntegrityError

user_bp = Blueprint('user_bp', __name__, url_prefix='/api/users')

# ----------------- Helpers -----------------

def _sync_user_roles(user: User, incoming_role_ids):
    """
    Sincroniza a lista de roles do usuário com uma lista de IDs (inteiros).
    Usa a relação roles_link explicitamente para evitar depender de creator no association_proxy.
    """
    if incoming_role_ids is None:
        return  # nada a fazer

    # Normaliza e calcula diffs
    desired_ids = {int(x) for x in incoming_role_ids}
    current_ids = {r.id for r in user.roles}

    add_ids = desired_ids - current_ids
    remove_ids = current_ids - desired_ids

    # Adições via UserRole (roles_link), evitando o .roles.append(...)
    if add_ids:
        roles_to_add = Role.query.filter(Role.id.in_(add_ids)).all()
        existing = { (link.role_id) for link in user.roles_link }
        for r in roles_to_add:
            if r.id not in existing:
                user.roles_link.append(UserRole(user_id=user.id, role_id=r.id))

    # Remoções em massa
    if remove_ids:
        UserRole.query.filter(
            UserRole.user_id == user.id,
            UserRole.role_id.in_(remove_ids)
        ).delete(synchronize_session=False)


def _sync_user_teams(user: User, incoming_teams):
    """
    Sincroniza equipes do usuário com base em uma lista de dicts: [{ id, is_manager }]
    """
    if incoming_teams is None:
        return  # nada a fazer

    # Mapeia atuais por team_id
    current_by_team = {assoc.team_id: assoc for assoc in user.teams}

    # Mapeia desejados por team_id
    desired_map = {}
    for item in incoming_teams:
        try:
            tid = int(item.get("id"))
        except Exception:
            continue
        desired_map[tid] = bool(item.get("is_manager", False))

    desired_ids = set(desired_map.keys())
    current_ids = set(current_by_team.keys())

    # Adições
    to_add = desired_ids - current_ids
    if to_add:
        teams_to_add = Team.query.filter(Team.id.in_(to_add)).all()
        for t in teams_to_add:
            assoc = UserTeam(user_id=user.id, team_id=t.id, is_manager=desired_map.get(t.id, False))
            db.session.add(assoc)

    # Atualizações (presente em ambos -> só sincroniza is_manager)
    to_update = desired_ids & current_ids
    for tid in to_update:
        assoc = current_by_team[tid]
        new_manager = desired_map.get(tid, False)
        if assoc.is_manager != new_manager:
            assoc.is_manager = new_manager

    # Remoções
    to_remove = current_ids - desired_ids
    if to_remove:
        UserTeam.query.filter(
            UserTeam.user_id == user.id,
            UserTeam.team_id.in_(to_remove)
        ).delete(synchronize_session=False)


# ----------------- Rotas -----------------

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
    
    if not user.check_password(current_password):
        return jsonify({"error": "Senha atual incorreta"}), 400
    
    if len(new_password) < 6:
        return jsonify({"error": "A nova senha deve ter pelo menos 6 caracteres"}), 400
    
    user.set_password(new_password)
    db.session.commit()
    
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
    
    if not re.match(r'^#[0-9A-Fa-f]{6}$', icon_color):
        return jsonify({"error": "Formato de cor inválido. Use formato hex (#RRGGBB)"}), 400
    
    user.icon_color = icon_color
    db.session.commit()
    
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
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '').strip()
        query = User.query
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                db.or_(
                    User.username.ilike(search_filter),
                    User.email.ilike(search_filter)
                )
            )
        query = query.order_by(User.username.asc())
        users_pagination = query.paginate(page=page, per_page=per_page, error_out=False)
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
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"error": "username, email e password são obrigatórios"}), 400

    user = User(
        username=username.strip(),
        email=email.strip(),
        is_admin=data.get('is_admin', False),
        is_active=True,
        icon_color=data.get('icon_color') or '#3498db'
    )
    user.set_password(password)

    db.session.add(user)
    db.session.flush()  # gera ID sem encerrar a transação

    try:
        # Sincroniza roles e teams enviados no payload de criação
        _sync_user_roles(user, data.get('roles'))                  # roles: [int]
        _sync_user_teams(user, data.get('teams'))                  # teams: [{id,is_manager}]
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Violação de integridade ao criar usuário"}), 400

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
    data = request.get_json() or {}

    # 🔒 Proteção do admin master
    if user_id == 6:
        if "is_admin" in data and data["is_admin"] is False:
            return jsonify({"error": "O admin master não pode perder privilégios"}), 403
        if "is_active" in data and data["is_active"] is False:
            return jsonify({"error": "O admin master não pode ser inativado"}), 403

    # Campos básicos
    user.username = data.get('username', user.username)
    user.email = data.get('email', user.email)

    if user_id != 6:
        if 'is_admin' in data:
            user.is_admin = bool(data.get('is_admin'))
        if 'is_active' in data:
            user.is_active = bool(data.get('is_active'))

    if 'icon_color' in data:
        icon_color = data.get('icon_color')
        if icon_color and re.match(r'^#[0-9A-Fa-f]{6}$', icon_color):
            user.icon_color = icon_color

    # Sincroniza roles/equipes se enviados
    try:
        _sync_user_roles(user, data.get('roles'))   # [int]
        _sync_user_teams(user, data.get('teams'))   # [{id,is_manager}]
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Violação de integridade ao atualizar usuário"}), 400

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
    if user_id == 6:
        return jsonify({"error": "O admin master não pode ser excluído"}), 403

    user = User.query.get_or_404(user_id)

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

# --------- Endpoints específicos de roles ---------

@user_bp.route('/<int:user_id>/roles', methods=['POST'])
@admin_required
def add_role_to_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    role_id = data.get('role_id')
    if not role_id:
        return jsonify({'error': 'role_id é obrigatório'}), 400
    role = Role.query.get_or_404(role_id)
    if role in user.roles:
        return jsonify({'error': 'Usuário já possui essa role'}), 400
    user.roles.append(role)
    db.session.commit()

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
    user = User.query.get_or_404(user_id)
    role = Role.query.get_or_404(role_id)
    if role not in user.roles:
        return jsonify({'error': 'Usuário não possui essa role'}), 400
    user.roles.remove(role)
    db.session.commit()

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
