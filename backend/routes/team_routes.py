from flask import Blueprint, request, jsonify
from models.team_model import Team
from extensions import db
from decorators import admin_required
from models.user_model import User

team_bp = Blueprint('team_bp', __name__, url_prefix='/api/teams')

@team_bp.route('/', methods=['GET'])
@admin_required
def list_teams():
    teams = Team.query.all()
    return jsonify([team.to_dict() for team in teams])

@team_bp.route('/', methods=['POST'])
@admin_required
def create_team():
    data = request.json
    team = Team(
        name=data['name'],
        description=data.get('description')
    )
    db.session.add(team)
    db.session.commit()
    return jsonify(team.to_dict()), 201

@team_bp.route('/<int:team_id>', methods=['PUT'])
@admin_required
def update_team(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.json
    team.name = data.get('name', team.name)
    team.description = data.get('description', team.description)
    db.session.commit()
    return jsonify(team.to_dict())

@team_bp.route('/<int:team_id>', methods=['DELETE'])
@admin_required
def delete_team(team_id):
    team = Team.query.get_or_404(team_id)
    db.session.delete(team)
    db.session.commit()
    return jsonify({'message': 'Time excluído com sucesso.'})

# Se quiser gerenciar membros do time:
@team_bp.route('/<int:team_id>/users', methods=['POST'])
@admin_required
def add_user_to_team(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.json
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id é obrigatório'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    if user not in team.users:
        team.users.append(user)
        db.session.commit()

    return jsonify({'message': f'Usuário {user.name} adicionado ao time {team.name}.'})
