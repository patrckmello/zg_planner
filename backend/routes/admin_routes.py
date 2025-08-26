from flask import Blueprint, request, jsonify, send_file
from models.user_model import User
from models.task_model import Task
from models.backup_model import Backup
from models.audit_log_model import AuditLog
from extensions import db
from decorators import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import subprocess
import datetime
import csv
import io
from werkzeug.utils import secure_filename

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/api/admin")

@admin_bp.route("/system-stats", methods=["GET"])
@admin_required
def get_system_stats():
    """Retorna estatísticas do sistema"""
    try:
        # Contar usuários ativos
        total_users = User.query.filter_by(is_active=True).count()
        
        # Contar total de tarefas
        total_tasks = Task.query.count()
        
        # Contar backups realizados
        total_backups = Backup.query.filter_by(status='completed').count()
        
        # Contar logs de auditoria
        total_audit_logs = AuditLog.query.count()
        
        # Estatísticas adicionais
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
        
        # Último backup
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
        # Obter tipo de backup da requisição (padrão: full)
        backup_type = request.json.get('type', 'full') if request.is_json else 'full'
        
        if backup_type not in ['full', 'schema_only', 'data_only']:
            return jsonify({'error': 'Tipo de backup inválido'}), 400
        
        # Usar o serviço de backup
        backup_service = BackupService(app)
        result = backup_service.create_full_backup(current_user_id, backup_type)
        
        # Log da ação
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
        
        # Log da ação
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
        
        # Remover arquivo do sistema se existir
        if backup.file_path and os.path.exists(backup.file_path):
            os.remove(backup.file_path)
        
        # Remover registro do banco
        db.session.delete(backup)
        db.session.commit()
        
        # Log da ação
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
        # Parâmetros de paginação
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Filtros opcionais
        action = request.args.get('action')
        user_id = request.args.get('user_id', type=int)
        
        query = AuditLog.query
        
        if action:
            query = query.filter(AuditLog.action == action)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        
        # Ordenar por data decrescente
        query = query.order_by(AuditLog.created_at.desc())
        
        # Paginação
        logs_pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Preparar resposta com logs e metadados de paginação
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
        # Buscar todos os logs (ou aplicar filtros se necessário)
        logs = AuditLog.query.order_by(AuditLog.created_at.desc()).all()
        
        # Criar CSV em memória
        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        
        # Cabeçalho
        writer.writerow([
            'ID', 'Usuário', 'Ação', 'Tipo de Recurso', 'ID do Recurso',
            'Descrição', 'IP', 'User Agent', 'Data/Hora'
        ])
        
        # Dados
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
                datetime.datetime.strptime(data['created_at'], '%Y-%m-%dT%H:%M:%S.%f').strftime('%d/%m/%Y %H:%M:%S') if data['created_at'] else ''
            ])
        
        # Preparar arquivo para download
        output.seek(0)
        
        # Log da ação
        current_user_id = get_jwt_identity()
        AuditLog.log_action(
            user_id=current_user_id,
            action='EXPORT_AUDIT_LOGS',
            description='Exportou logs de auditoria',
            resource_type='audit_log',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        # Criar arquivo temporário
        filename = f'audit_logs_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


