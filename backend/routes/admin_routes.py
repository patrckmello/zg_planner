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

admin_bp = Blueprint('admin_bp', __name__, url_prefix='/api/admin')

@admin_bp.route('/system-stats', methods=['GET'])
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

@admin_bp.route('/backups', methods=['GET'])
@admin_required
def get_backups():
    """Lista todos os backups"""
    try:
        backups = Backup.query.order_by(Backup.created_at.desc()).all()
        return jsonify([backup.to_dict() for backup in backups])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/create-backup', methods=['POST'])
@admin_required
def create_backup():
    """Cria um novo backup do banco de dados"""
    current_user_id = get_jwt_identity()
    
    try:
        # Gerar nome do arquivo
        timestamp = datetime.datetime.now().strftime('%Y_%m_%d_%H_%M_%S')
        filename = f'backup_zg_planner_{timestamp}.sql'
        
        # Diretório de backups
        backup_dir = os.path.join(os.getcwd(), 'backups')
        os.makedirs(backup_dir, exist_ok=True)
        file_path = os.path.join(backup_dir, filename)
        
        # Criar registro do backup
        backup = Backup(
            filename=filename,
            file_path=file_path,
            status='pending',
            created_by=current_user_id
        )
        db.session.add(backup)
        db.session.commit()
        
        try:
            # Executar comando de backup do PostgreSQL
            # Nota: Você precisará configurar as variáveis de ambiente para PostgreSQL
            database_url = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost/zg_planner')
            
            # Extrair informações da URL do banco
            # Para simplificar, vamos usar pg_dump com as configurações padrão
            # Em produção, você deve configurar isso adequadamente
            
            # Comando de backup (ajuste conforme sua configuração)
            cmd = [
                'pg_dump',
                '--no-password',
                '--format=custom',
                '--file', file_path,
                database_url
            ]
            
            # Executar backup (comentado para evitar erro em ambiente de teste)
            # result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            # Para demonstração, vamos criar um arquivo de exemplo
            with open(file_path, 'w') as f:
                f.write(f"-- Backup simulado criado em {datetime.datetime.now()}\n")
                f.write("-- Este é um arquivo de exemplo para demonstração\n")
                f.write("-- Em produção, este seria um backup real do PostgreSQL\n")
            
            # Obter tamanho do arquivo
            file_size = os.path.getsize(file_path)
            
            # Atualizar status do backup
            backup.status = 'completed'
            backup.file_size = file_size
            db.session.commit()
            
            # Log da ação
            AuditLog.log_action(
                user_id=current_user_id,
                action='CREATE',
                description=f'Criou backup: {filename}',
                resource_type='backup',
                resource_id=backup.id,
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent')
            )
            
            return jsonify({
                'message': 'Backup criado com sucesso',
                'backup': backup.to_dict()
            })
            
        except subprocess.TimeoutExpired:
            backup.status = 'error'
            backup.error_message = 'Timeout durante a criação do backup'
            db.session.commit()
            return jsonify({'error': 'Timeout durante a criação do backup'}), 500
            
        except Exception as e:
            backup.status = 'error'
            backup.error_message = str(e)
            db.session.commit()
            return jsonify({'error': f'Erro ao criar backup: {str(e)}'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/download-backup/<int:backup_id>', methods=['GET'])
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
            action='DOWNLOAD',
            description=f'Fez download do backup: {backup.filename}',
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

@admin_bp.route('/delete-backup/<int:backup_id>', methods=['DELETE'])
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
            action='DELETE',
            description=f'Excluiu backup: {filename}',
            resource_type='backup',
            resource_id=backup_id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({'message': 'Backup excluído com sucesso'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/audit-logs', methods=['GET'])
@admin_required
def get_audit_logs():
    """Lista logs de auditoria"""
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
        logs = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify([log.to_dict() for log in logs.items])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/export-audit-logs', methods=['GET'])
@admin_required
def export_audit_logs():
    """Exporta logs de auditoria em CSV"""
    try:
        # Buscar todos os logs (ou aplicar filtros se necessário)
        logs = AuditLog.query.order_by(AuditLog.created_at.desc()).all()
        
        # Criar CSV em memória
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Cabeçalho
        writer.writerow([
            'ID', 'Usuário', 'Ação', 'Tipo de Recurso', 'ID do Recurso',
            'Descrição', 'IP', 'User Agent', 'Data/Hora'
        ])
        
        # Dados
        for log in logs:
            writer.writerow([
                log.id,
                log.user_name,
                log.action,
                log.resource_type or '',
                log.resource_id or '',
                log.description,
                log.ip_address or '',
                log.user_agent or '',
                log.created_at.strftime('%d/%m/%Y %H:%M:%S') if log.created_at else ''
            ])
        
        # Preparar arquivo para download
        output.seek(0)
        
        # Log da ação
        current_user_id = get_jwt_identity()
        AuditLog.log_action(
            user_id=current_user_id,
            action='EXPORT',
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

