from flask import Blueprint, request, jsonify
from models.team_model import Team
from extensions import db
from decorators import admin_required
from models.user_model import User
from models.user_team_model import UserTeam
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.task_model import Task
from models.audit_log_model import AuditLog

# REMOVA a barra final do url_prefix
team_bp = Blueprint("team_bp", __name__, url_prefix="/api/teams")

@team_bp.route("", methods=["GET"])
@jwt_required()
def list_teams():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if user.is_admin:
        teams = Team.query.all()
    else:
        team_ids = [ut.team_id for ut in user.teams]
        teams = Team.query.filter(Team.id.in_(team_ids)).all()

    def scrub_member(ut):
        return {
            "user_id": ut.user.id,
            "username": ut.user.username,
            # opcional: ocultar e-mail para não-admins
            "email": ut.user.email if user.is_admin else None,
            "is_manager": ut.is_manager
        } if ut.user else None

    out = []
    for t in teams:
        members = [scrub_member(ut) for ut in t.members if ut.user]
        out.append({
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "created_at": t.created_at.isoformat(),
            "members": members
        })
    return jsonify(out)

@team_bp.route("", methods=["POST"])
@admin_required
def create_team():
    data = request.json
    name = data.get("name", "").strip()
    description = data.get("description")

    if not name:
        return jsonify({"error": "O nome da equipe é obrigatório."}), 400

    # Verifica duplicidade do nome (case insensitive se quiser)
    existing_team = Team.query.filter(Team.name.ilike(name)).first()
    if existing_team:
        return jsonify({"error": "Já existe uma equipe com esse nome."}), 400

    team = Team(name=name, description=description)
    db.session.add(team)
    db.session.commit()

    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='CREATE',
        description=f'Criou equipe: {team.name}',
        resource_type='team',
        resource_id=team.id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

    return jsonify(team.to_dict()), 201

@team_bp.route("/<int:team_id>", methods=["PUT"])
@admin_required
def update_team(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.json
    old_name = team.name
    team.name = data.get("name", team.name)
    team.description = data.get("description", team.description)
    db.session.commit()

    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE',
        description=f'Atualizou equipe: {old_name} para {team.name}',
        resource_type='team',
        resource_id=team.id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

    return jsonify(team.to_dict())

@team_bp.route("/<int:team_id>", methods=["DELETE"])
@admin_required
def delete_team(team_id):
    team = Team.query.get_or_404(team_id)
    team_name = team.name
    db.session.delete(team)
    db.session.commit()

    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='DELETE',
        description=f'Excluiu equipe: {team_name}',
        resource_type='team',
        resource_id=team_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

    return jsonify({"message": "Time excluído com sucesso."})

from sqlalchemy.exc import IntegrityError

@team_bp.route("/<int:team_id>/users", methods=["POST"])
@admin_required
def add_user_to_team(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.json or {}
    user_id = data.get("user_id")
    is_manager = bool(data.get("is_manager", False))

    if not user_id:
        return jsonify({"error": "user_id é obrigatório"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404

    # checagem rápida (otimista)
    existing = UserTeam.query.filter_by(user_id=user_id, team_id=team_id).first()
    if existing:
        return jsonify({"error": "Usuário já faz parte desse time."}), 400

    user_team = UserTeam(user_id=user_id, team_id=team_id, is_manager=is_manager)
    db.session.add(user_team)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Usuário já faz parte desse time."}), 409

    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='ADD_MEMBER',
        description=f'Adicionou {user.username} à equipe {team.name} (Gestor: {is_manager})',
        resource_type='team_member',
        resource_id=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

    return jsonify(team.to_dict()), 201

@team_bp.route("/<int:team_id>/users", methods=["GET"])
@admin_required
def list_team_users(team_id):
    team = Team.query.get_or_404(team_id)
    members = [
        {
            "user_id": ut.user.id,
            "username": ut.user.username,
            "email": ut.user.email,
            "is_manager": ut.is_manager
        }
        for ut in team.members
        if ut.user is not None
    ]
    return jsonify(members)

@team_bp.route("/<int:team_id>/users/<int:user_id>", methods=["DELETE"])
@admin_required
def remove_user_from_team(team_id, user_id):
    association = UserTeam.query.filter_by(user_id=user_id, team_id=team_id).first()
    if not association:
        return jsonify({"error": "Associação não encontrada"}), 404

    user = User.query.get(user_id)
    team = Team.query.get(team_id)

    db.session.delete(association)
    db.session.commit()

    current_user_id = get_jwt_identity()
    AuditLog.log_action(
        user_id=current_user_id,
        action='REMOVE_MEMBER',
        description=f'Removeu {user.username} da equipe {team.name}',
        resource_type='team_member',
        resource_id=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

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

    old_is_manager = user_team.is_manager
    if is_manager is not None:
        user_team.is_manager = is_manager

    db.session.commit()

    current_user_id = get_jwt_identity()
    action_desc = f'Atualizou status de {user_team.user.username} na equipe {user_team.team.name}: Gestor de {old_is_manager} para {is_manager}'
    AuditLog.log_action(
        user_id=current_user_id,
        action='UPDATE_MEMBER_ROLE',
        description=action_desc,
        resource_type='team_member',
        resource_id=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

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
        if ut.user is not None
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
        if not member:  # ignora registros órfãos
            continue

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


