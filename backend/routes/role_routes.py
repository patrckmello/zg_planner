from flask import Blueprint, request, jsonify
from models.role_model import Role
from extensions import db
from decorators import admin_required

# REMOVA a barra final do url_prefix
role_bp = Blueprint('role_bp', __name__, url_prefix='/api/roles')

# REMOVA as barras finais de todas as rotas
@role_bp.route('', methods=['GET'])  # Era '/', agora é ''
@admin_required
def list_roles():
    roles = Role.query.all()
    return jsonify([role.to_dict() for role in roles])

@role_bp.route('', methods=['POST'])  # Era '/', agora é ''
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
    role.name = data.get('name', role.name)
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
