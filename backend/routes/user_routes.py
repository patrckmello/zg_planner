from flask import Blueprint, request, jsonify
from models.user_model import User
from extensions import db
from decorators import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity

user_bp = Blueprint('user_bp', __name__, url_prefix='/api/users')

@user_bp.route('/me')
@jwt_required()
def get_me():
    print(request.headers.get('Authorization'))  # Deve mostrar "Bearer <token>"
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    return jsonify(user.to_dict())

@user_bp.route('', methods=['GET'])
@admin_required
def list_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

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
    return jsonify(user.to_dict()), 201

@user_bp.route('/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    user.username = data.get('username', user.username)
    user.email = data.get('email', user.email)
    user.is_admin = data.get('is_admin', user.is_admin)
    user.is_active = data.get('is_active', user.is_active)  # Aqui!

    db.session.commit()
    return jsonify(user.to_dict())

@user_bp.route('/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Usuário excluído com sucesso.'})
