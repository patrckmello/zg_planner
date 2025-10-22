# routes/admin_routes.py
from flask import Blueprint, request, jsonify, send_file, current_app
from models.user_model import User
from models.task_model import Task
from models.backup_model import Backup
from models.audit_log_model import AuditLog
from extensions import db
from decorators import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import subprocess
from datetime import datetime, timedelta
from archive_scheduler import archive_done_tasks_once
import csv
import io
from werkzeug.utils import secure_filename

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/api/admin")

@admin_bp.route("/system-stats", methods=["GET"])
@admin_required
def get_system_stats():
    """Retorna estatísticas do sistema"""
    try:
        total_users = User.query.filter_by(is_active=True).count()
        total_tasks = Task.query.count()
        total_backups = Backup.query.filter_by(status='completed').count()
        total_audit_logs = AuditLog.query.count()
        admin_users = User.query.filter_by(is_admin=True, is_active=True).count()
        pending_backups = Backup.query.filter_by(status='pending').count()

        stats = {
            'total_users': total_users,
            'total_tasks': total_tasks,
            'total_backups': total_backups,
            'total_audit_logs': total_audit_logs,
            'admin_users': admin_users,
            'pending_backups': pending_backups,
            'last_backup': None
        }

        last_backup = Backup.query.filter_by(status='completed').order_by(Backup.created_at.desc()).first()
        if last_backup:
            stats['last_backup'] = last_backup.created_at.isoformat()

        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route("/backups", methods=["GET"])
@admin_required
def get_backups():
    """Lista todos os backups"""
    try:
        backups = Backup.query.order_by(Backup.created_at.desc()).all()
        return jsonify([backup.to_dict() for backup in backups])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route("/create-backup", methods=["POST"])
@admin_required
def create_backup():
    """Cria um novo backup do banco de dados usando o BackupService"""
    from backup_service import BackupService
    from app import app

    current_user_id = get_jwt_identity()

    try:
        backup_type = request.json.get('type', 'full') if request.is_json else 'full'
        if backup_type not in ['full', 'schema_only', 'data_only']:
            return jsonify({'error': 'Tipo de backup inválido'}), 400

        backup_service = BackupService(app)
        result = backup_service.create_full_backup(current_user_id, backup_type)

        AuditLog.log_action(
            user_id=current_user_id,
            action='CREATE_BACKUP',
            description=f"Criou backup do tipo: {backup_type}",
            resource_type='backup',
            resource_id=result.get('backup_id'),
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )

        if result['success']:
            return jsonify({
                'message': result['message'],
                'backup': result['backup']
            })
        else:
            return jsonify({
                'error': result['error'],
                'backup_id': result.get('backup_id')
            }), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route("/download-backup/<int:backup_id>", methods=["GET"])
@admin_required
def download_backup(backup_id):
    """Faz download de um backup específico"""
    try:
        backup = Backup.query.get_or_404(backup_id)

        if backup.status != 'completed':
            return jsonify({'error': 'Backup não está disponível para download'}), 400

        if not os.path.exists(backup.file_path):
            return jsonify({'error': 'Arquivo de backup não encontrado'}), 404

        current_user_id = get_jwt_identity()
        AuditLog.log_action(
            user_id=current_user_id,
            action='DOWNLOAD_BACKUP',
            description=f"Fez download do backup: {backup.filename}",
            resource_type='backup',
            resource_id=backup_id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )

        return send_file(
            backup.file_path,
            as_attachment=True,
            download_name=backup.filename,
            mimetype='application/octet-stream'
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route("/delete-backup/<int:backup_id>", methods=["DELETE"])
@admin_required
def delete_backup(backup_id):
    """Exclui um backup específico"""
    try:
        backup = Backup.query.get_or_404(backup_id)
        filename = backup.filename

        if backup.file_path and os.path.exists(backup.file_path):
            os.remove(backup.file_path)

        db.session.delete(backup)
        db.session.commit()

        current_user_id = get_jwt_identity()
        AuditLog.log_action(
            user_id=current_user_id,
            action='DELETE_BACKUP',
            description=f"Excluiu backup: {filename}",
            resource_type='backup',
            resource_id=backup_id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )

        return jsonify({'message': 'Backup excluído com sucesso'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route("/audit-logs", methods=["GET"])
@admin_required
def get_audit_logs():
    """Lista logs de auditoria com paginação e metadados"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        action = request.args.get('action')
        user_id = request.args.get('user_id', type=int)

        query = AuditLog.query
        if action:
            query = query.filter(AuditLog.action == action)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)

        query = query.order_by(AuditLog.created_at.desc())
        logs_pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        response_data = {
            "items": [log.to_dict() for log in logs_pagination.items],
            "pagination": {
                "total_items": logs_pagination.total,
                "total_pages": logs_pagination.pages,
                "current_page": logs_pagination.page,
                "per_page": logs_pagination.per_page,
                "has_next": logs_pagination.has_next,
                "has_prev": logs_pagination.has_prev,
                "next_num": logs_pagination.next_num,
                "prev_num": logs_pagination.prev_num
            }
        }
        return jsonify(response_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route("/export-audit-logs", methods=["GET"])
@admin_required
def export_audit_logs():
    """Exporta logs de auditoria em CSV"""
    try:
        logs = AuditLog.query.order_by(AuditLog.created_at.desc()).all()

        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)

        writer.writerow([
            'ID', 'Usuário', 'Ação', 'Tipo de Recurso', 'ID do Recurso',
            'Descrição', 'IP', 'User Agent', 'Data/Hora'
        ])

        for log in logs:
            data = log.to_dict()
            writer.writerow([
                data['id'],
                data['user_name'],
                data['action'],
                data['resource_type'] or '',
                data['resource_id'] or '',
                data['description'],
                data['ip_address'] or '',
                data['user_agent'] or '',
                datetime.strptime(data['created_at'], '%Y-%m-%dT%H:%M:%S.%f').strftime('%d/%m/%Y %H:%M:%S') if data['created_at'] else ''
            ])

        output.seek(0)

        current_user_id = get_jwt_identity()
        AuditLog.log_action(
            user_id=current_user_id,
            action='EXPORT_AUDIT_LOGS',
            description='Exportou logs de auditoria',
            resource_type='audit_log',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )

        filename = f'audit_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------
# Helpers para purge
# ---------------------
def _hard_delete_task(task: Task):
    """Remove anexos do disco e apaga o registro da tarefa."""
    try:
        for a in task.anexos or []:
            name = a.get("name") if isinstance(a, dict) else str(a)
            if not name:
                continue
            path = os.path.join(current_app.config["UPLOAD_FOLDER"], name)
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
    except Exception:
        pass

    db.session.delete(task)

def _require_admin():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or not user.is_admin:
        return None, (jsonify({"error": "Acesso negado (admin apenas)."}), 403)
    return user, None

@admin_bp.delete("/tasks/<int:task_id>/purge")
@jwt_required()
def purge_task(task_id):
    user, err = _require_admin()
    if err: return err

    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Tarefa não encontrada"}), 404
    if not task.is_deleted:
        return jsonify({"error": "A tarefa precisa estar na lixeira (soft delete) para purge."}), 400

    title = task.title
    _hard_delete_task(task)
    db.session.commit()

    AuditLog.log_action(
        user_id=user.id,
        action="PURGE_TASK",
        resource_type="Task",
        resource_id=task_id,
        description=f"Tarefa purgada (exclusão permanente): {title}",
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent"),
    )
    return jsonify({"purged": 1, "id": task_id}), 200

@admin_bp.post("/tasks/purge-old")
@jwt_required()
def purge_old_tasks():
    user, err = _require_admin()
    if err: return err

    try:
        body = request.get_json(silent=True) or {}
        days = int(body.get("days", 7))
    except (TypeError, ValueError):
        days = 7

    cutoff = datetime.utcnow() - timedelta(days=days)
    to_purge = Task.query.filter(
        Task.deleted_at.isnot(None),
        Task.deleted_at < cutoff
    ).all()

    count = 0
    for t in to_purge:
        _hard_delete_task(t)
        count += 1

    db.session.commit()

    AuditLog.log_action(
        user_id=user.id,
        action="PURGE_OLD_TRASH",
        resource_type="Task",
        resource_id=None,
        description=f"Esvaziou lixeira > {days} dias. Removidos: {count}",
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent"),
    )
    return jsonify({"purged": count, "days": days}), 200

# ---------------------
# NOVOS endpoints úteis
# ---------------------

@admin_bp.get("/scheduler/jobs")
@admin_required
def list_scheduler_jobs():
    """
    Lista os jobs do APScheduler (id, nome, próximo disparo, trigger).
    Útil para checar se o `email_weekly_backup` está com next_run correto.
    """
    try:
        from backup_scheduler import backup_scheduler
        jobs = backup_scheduler.list_jobs() if backup_scheduler else []
        return jsonify({"jobs": jobs})
    except Exception as e:
        current_app.logger.exception("Falha ao listar jobs")
        return jsonify({"error": str(e)}), 500


@admin_bp.post("/backup/test-email-in")
@admin_required
def schedule_test_backup_email_in():
    """
    Agenda um disparo único do e-mail de backup para N minutos à frente.
    Body JSON: { "minutes": 2 }  (default=2)
    """
    try:
        from backup_scheduler import backup_scheduler
        data = request.get_json(silent=True) or {}
        minutes = int(data.get("minutes", 2))
        backup_scheduler.trigger_test_email_once(minutes_from_now=minutes)
        return jsonify({"ok": True, "scheduled_in_minutes": minutes})
    except Exception as e:
        current_app.logger.exception("Falha ao agendar teste de e-mail de backup")
        return jsonify({"ok": False, "error": str(e)}), 500


@admin_bp.route("/archive/run-now", methods=["POST"])
@admin_required
def run_archive_now():
    try:
        count = archive_done_tasks_once(current_app, days=int(request.args.get("days", "7")))
        return jsonify({"archived": count}), 200
    except Exception as e:
        current_app.logger.exception("Falha ao rodar arquivamento manual")
        db.session.rollback()
        return jsonify({"error": "failed", "detail": str(e)}), 500