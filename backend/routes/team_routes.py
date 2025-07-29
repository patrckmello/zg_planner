from flask import Blueprint, request, jsonify
from models.team_model import Team
from extensions import db
from decorators import admin_required
from models.user_model import User
from models.user_team_model import UserTeam
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.task_model import Task

# REMOVA a barra final do url_prefix
team_bp = Blueprint("team_bp", __name__, url_prefix="/api/teams")

@team_bp.route("", methods=["GET"])
@admin_required
def list_teams():
    teams = Team.query.all()
    teams_data = []
    for team in teams:
        teams_data.append({
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "created_at": team.created_at.isoformat(),
            "members": [
                {
                    "user_id": ut.user.id,
                    "username": ut.user.username,
                    "email": ut.user.email,
                    "is_manager": ut.is_manager
                } for ut in team.members
            ]
        })
    return jsonify(teams_data)

@team_bp.route("", methods=["POST"]) # Era '/', agora é ''
@admin_required
def create_team():
    data = request.json
    team = Team(
        name=data["name"],
        description=data.get("description")
    )
    db.session.add(team)
    db.session.commit()
    return jsonify(team.to_dict()), 201

@team_bp.route("/<int:team_id>", methods=["PUT"])
@admin_required
def update_team(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.json
    team.name = data.get("name", team.name)
    team.description = data.get("description", team.description)
    db.session.commit()
    return jsonify(team.to_dict())

@team_bp.route("/<int:team_id>", methods=["DELETE"])
@admin_required
def delete_team(team_id):
    team = Team.query.get_or_404(team_id)
    db.session.delete(team)
    db.session.commit()
    return jsonify({"message": "Time excluído com sucesso."})

# Se quiser gerenciar membros do time:
@team_bp.route("/<int:team_id>/users", methods=["POST"])
@admin_required
def add_user_to_team(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.json

    user_id = data.get("user_id")
    is_manager = data.get("is_manager", False)

    if not user_id:
        return jsonify({"error": "user_id é obrigatório"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404

    existing = UserTeam.query.filter_by(user_id=user_id, team_id=team_id).first()
    if existing:
        return jsonify({"error": "Usuário já faz parte desse time."}), 400

    user_team = UserTeam(user_id=user_id, team_id=team_id, is_manager=is_manager)
    db.session.add(user_team)
    db.session.commit()

    # Atualiza o time para pegar os membros atualizados
    updated_team = Team.query.get(team_id)
    return jsonify(updated_team.to_dict()), 201

@team_bp.route("/<int:team_id>/users", methods=["GET"])
@admin_required
def list_team_users(team_id):
    team = Team.query.get_or_404(team_id)
    members = [
        {
            "user_id": ut.user.id,
            "name": ut.user.username,
            "email": ut.user.email,
            "is_manager": ut.is_manager
        }
        for ut in team.members
    ]
    return jsonify(members)

@team_bp.route("/<int:team_id>/users/<int:user_id>", methods=["DELETE"])
@admin_required
def remove_user_from_team(team_id, user_id):
    association = UserTeam.query.filter_by(user_id=user_id, team_id=team_id).first()
    if not association:
        return jsonify({"error": "Associação não encontrada"}), 404

    db.session.delete(association)
    db.session.commit()

    # Pega o time atualizado com membros atualizados
    team = Team.query.get_or_404(team_id)
    members = [
        {
            "user_id": ut.user.id,
            "username": ut.user.username,
            "email": ut.user.email,
            "is_manager": ut.is_manager
        }
        for ut in team.members
    ]

    return jsonify({
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "members": members
    })

@team_bp.route("/<int:team_id>/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user_in_team(team_id, user_id):
    data = request.json
    is_manager = data.get("is_manager")

    user_team = UserTeam.query.filter_by(user_id=user_id, team_id=team_id).first()

    if not user_team:
        return jsonify({"error": "Usuário não está associado a este time."}), 404

    if is_manager is not None:
        user_team.is_manager = is_manager

    db.session.commit()

    # Pega o time atualizado com membros atualizados
    team = Team.query.get_or_404(team_id)
    members = [
        {
            "user_id": ut.user.id,
            "username": ut.user.username,
            "email": ut.user.email,
            "is_manager": ut.is_manager
        }
        for ut in team.members
    ]

    return jsonify({
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "members": members
    })


@team_bp.route("/<int:team_id>/productivity", methods=["GET"])
@jwt_required()
def team_productivity(team_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({"error": "Usuário inválido ou inativo"}), 401

    # Permissão: admin OU gestor da equipe
    if not user.is_admin:
        manager_link = UserTeam.query.filter_by(user_id=user_id, team_id=team_id, is_manager=True).first()
        if not manager_link:
            return jsonify({"error": "Acesso negado. Apenas gestores ou admins podem ver este relatório."}), 403

    team = Team.query.get_or_404(team_id)

    user_teams = UserTeam.query.filter_by(team_id=team_id).all()

    data = []
    for ut in user_teams:
        member = ut.user
        total_tasks = Task.query.filter_by(user_id=member.id).count()
        completed_tasks = Task.query.filter_by(user_id=member.id, status="done").count()

        data.append({
            "user_id": member.id,
            "user_name": member.username,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "completion_rate": f"{(completed_tasks / total_tasks * 100) if total_tasks else 0:.1f}%"
        })

    return jsonify({"team_id": team.id, "team_name": team.name, "productivity": data}), 200
