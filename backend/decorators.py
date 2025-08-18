from functools import wraps
from flask import request, jsonify, session
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models.user_model import User
from models.user_team_model import UserTeam

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user or not user.is_admin:
            return jsonify({'error': 'Acesso negado. Permissão de admin necessária.'}), 403

        return fn(*args, **kwargs)
    return wrapper

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()  # Verifica o token JWT
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user or not user.is_active:
            return jsonify({'error': 'Usuário inválido ou inativo'}), 401

        return f(*args, **kwargs)
    return decorated_function

def requires_permission(permission):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)

            if not user or not user.is_active:
                return jsonify({'msg': 'Usuário inválido ou inativo'}), 401
            
            if not user.has_permission(permission):
                return jsonify({'msg': 'Permissão negada'}), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator


def manager_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user or not user.is_active:
            return jsonify({'error': 'Usuário inválido ou inativo'}), 401

        # Verifica se o user é gestor em pelo menos um time
        manager_link = UserTeam.query.filter_by(user_id=user.id, is_manager=True).first()
        if not manager_link:
            return jsonify({'error': 'Acesso negado. Apenas gestores de equipe têm permissão.'}), 403

        return fn(*args, **kwargs)
    return wrapper