from functools import wraps
from flask import request, jsonify, session
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models.user_model import User

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
        if 'user_id' not in session:
            return jsonify({'error': 'Login requerido'}), 401
        return f(*args, **kwargs)
    return decorated_function