from flask import Blueprint, request, jsonify
from models.comment_model import Comment
from models.task_model import Task
from models.user_model import User
from extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

comment_bp = Blueprint("comments", __name__, url_prefix="/api")

@comment_bp.route("/tasks/<int:task_id>/comments", methods=["GET"])
@jwt_required()
def get_task_comments(task_id):
    """Buscar todos os comentários de uma tarefa"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"msg": "Usuário inválido ou inativo"}), 401

    # Verificar se a tarefa existe
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404

    # Verificar se o usuário pode ver a tarefa
    if not task.can_be_viewed_by(user):
        return jsonify({"error": "Acesso negado"}), 403

    # Buscar comentários da tarefa ordenados por data de criação
    comments = Comment.query.filter_by(task_id=task_id).order_by(Comment.created_at.asc()).all()
    
    return jsonify([comment.to_dict() for comment in comments])

@comment_bp.route("/tasks/<int:task_id>/comments", methods=["POST"])
@jwt_required()
def add_task_comment(task_id):
    """Adicionar um comentário a uma tarefa"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"msg": "Usuário inválido ou inativo"}), 401

    # Verificar se a tarefa existe
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404

    # Verificar se o usuário pode ver a tarefa
    if not task.can_be_viewed_by(user):
        return jsonify({"error": "Acesso negado"}), 403

    data = request.get_json()
    
    if not data or not data.get('content'):
        return jsonify({"error": "Conteúdo do comentário é obrigatório"}), 400

    content = data['content'].strip()
    if not content:
        return jsonify({"error": "Conteúdo do comentário não pode estar vazio"}), 400

    try:
        # Criar novo comentário
        new_comment = Comment(
            content=content,
            task_id=task_id,
            user_id=user_id
        )

        db.session.add(new_comment)
        db.session.commit()

        return jsonify(new_comment.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        print(f"Erro ao criar comentário: {e}")
        return jsonify({"error": "Erro interno no servidor"}), 500

@comment_bp.route("/comments/<int:comment_id>", methods=["PUT"])
@jwt_required()
def update_comment(comment_id):
    """Atualizar um comentário (apenas o autor pode editar)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"msg": "Usuário inválido ou inativo"}), 401

    comment = Comment.query.get(comment_id)
    if not comment:
        return jsonify({"error": "Comentário não encontrado"}), 404

    # Verificar se o usuário é o autor do comentário ou admin
    if comment.user_id != user_id and not user.is_admin:
        return jsonify({"error": "Apenas o autor pode editar este comentário"}), 403

    data = request.get_json()
    
    if not data or not data.get('content'):
        return jsonify({"error": "Conteúdo do comentário é obrigatório"}), 400

    content = data['content'].strip()
    if not content:
        return jsonify({"error": "Conteúdo do comentário não pode estar vazio"}), 400

    try:
        comment.content = content
        comment.updated_at = datetime.utcnow()
        
        db.session.commit()

        return jsonify(comment.to_dict())

    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar comentário: {e}")
        return jsonify({"error": "Erro interno no servidor"}), 500

@comment_bp.route("/comments/<int:comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(comment_id):
    """Excluir um comentário (apenas o autor ou admin pode excluir)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"msg": "Usuário inválido ou inativo"}), 401

    comment = Comment.query.get(comment_id)
    if not comment:
        return jsonify({"error": "Comentário não encontrado"}), 404

    # Verificar se o usuário é o autor do comentário ou admin
    if comment.user_id != user_id and not user.is_admin:
        return jsonify({"error": "Apenas o autor pode excluir este comentário"}), 403

    try:
        db.session.delete(comment)
        db.session.commit()

        return jsonify({"message": "Comentário excluído com sucesso"})

    except Exception as e:
        db.session.rollback()
        print(f"Erro ao excluir comentário: {e}")
        return jsonify({"error": "Erro interno no servidor"}), 500

