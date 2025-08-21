from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from decorators import admin_required
from backup_service import BackupService
from backup_scheduler import backup_scheduler
from backup_config import ACTIVE_CONFIG
from models.backup_model import Backup
from models.audit_log_model import AuditLog
import os

backup_bp = Blueprint('backup_bp', __name__, url_prefix='/api/backup')

@backup_bp.route('/create', methods=['POST'])
@admin_required
def create_backup_advanced():
    """Cria backup com opções avançadas"""
    current_user_id = get_jwt_identity()
    
    try:
        data = request.get_json() or {}
        
        # Parâmetros do backup
        backup_type = data.get('type', 'full')
        include_uploads = data.get('include_uploads', False)
        compress = data.get('compress', True)
        
        if not ACTIVE_CONFIG.is_valid_backup_type(backup_type):
            return jsonify({'error': 'Tipo de backup inválido'}), 400
        
        # Criar backup usando o serviço
        backup_service = BackupService(app)
        result = backup_service.create_full_backup(current_user_id, backup_type)
        
        if result['success']:
            # Log adicional para backup avançado
            AuditLog.log_action(
                user_id=current_user_id,
                action='CREATE_ADVANCED',
                description=f'Criou backup avançado: {result["backup"]["filename"]} (tipo: {backup_type})',
                resource_type='backup',
                resource_id=result['backup']['id'],
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent')
            )
            
            return jsonify({
                'success': True,
                'message': result['message'],
                'backup': result['backup'],
                'options': {
                    'type': backup_type,
                    'include_uploads': include_uploads,
                    'compress': compress
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/schedule', methods=['GET'])
@admin_required
def get_backup_schedule():
    """Obtém informações sobre agendamentos de backup"""
    try:
        jobs = backup_scheduler.list_jobs()
        
        return jsonify({
            'scheduler_running': backup_scheduler.scheduler.running if backup_scheduler.scheduler else False,
            'jobs': jobs,
            'retention_policy': ACTIVE_CONFIG.RETENTION_POLICY,
            'next_backups': [
                job for job in jobs 
                if job['next_run'] and 'backup' in job['id'].lower()
            ]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/schedule/start', methods=['POST'])
@admin_required
def start_backup_scheduler():
    """Inicia o agendador de backups"""
    current_user_id = get_jwt_identity()
    
    try:
        backup_scheduler.start()
        
        # Log da ação
        AuditLog.log_action(
            user_id=current_user_id,
            action='START_SCHEDULER',
            description='Iniciou agendador de backups',
            resource_type='scheduler',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'success': True,
            'message': 'Agendador de backups iniciado',
            'running': backup_scheduler.scheduler.running
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/schedule/stop', methods=['POST'])
@admin_required
def stop_backup_scheduler():
    """Para o agendador de backups"""
    current_user_id = get_jwt_identity()
    
    try:
        backup_scheduler.stop()
        
        # Log da ação
        AuditLog.log_action(
            user_id=current_user_id,
            action='STOP_SCHEDULER',
            description='Parou agendador de backups',
            resource_type='scheduler',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'success': True,
            'message': 'Agendador de backups parado',
            'running': backup_scheduler.scheduler.running if backup_scheduler.scheduler else False
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/config', methods=['GET'])
@admin_required
def get_backup_config():
    """Obtém configurações do sistema de backup"""
    try:
        config_info = {
            'backup_types': ACTIVE_CONFIG.BACKUP_TYPES,
            'retention_policy': ACTIVE_CONFIG.RETENTION_POLICY,
            'compression': ACTIVE_CONFIG.COMPRESSION,
            'timeouts': ACTIVE_CONFIG.TIMEOUTS,
            'security': {
                'encrypt_backups': ACTIVE_CONFIG.SECURITY['encrypt_backups'],
                'max_backup_size_mb': ACTIVE_CONFIG.SECURITY['max_backup_size'] // (1024 * 1024)
            },
            'backup_directory': ACTIVE_CONFIG.BACKUP_BASE_DIR,
            'environment': os.getenv('FLASK_ENV', 'development')
        }
        
        return jsonify(config_info)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/stats', methods=['GET'])
@admin_required
def get_backup_stats():
    """Obtém estatísticas detalhadas dos backups"""
    try:
        # Estatísticas básicas
        total_backups = Backup.query.count()
        completed_backups = Backup.query.filter_by(status='completed').count()
        failed_backups = Backup.query.filter_by(status='error').count()
        pending_backups = Backup.query.filter_by(status='pending').count()
        
        # Último backup
        last_backup = Backup.query.filter_by(status='completed').order_by(Backup.created_at.desc()).first()
        
        # Tamanho total dos backups
        completed_backup_records = Backup.query.filter_by(status='completed').all()
        total_size = sum(backup.file_size or 0 for backup in completed_backup_records)
        
        # Estatísticas por tipo (se implementado)
        stats_by_type = {}
        
        # Espaço em disco disponível
        backup_dir = ACTIVE_CONFIG.BACKUP_BASE_DIR
        if os.path.exists(backup_dir):
            statvfs = os.statvfs(backup_dir)
            free_space = statvfs.f_frsize * statvfs.f_bavail
            total_space = statvfs.f_frsize * statvfs.f_blocks
        else:
            free_space = 0
            total_space = 0
        
        stats = {
            'total_backups': total_backups,
            'completed_backups': completed_backups,
            'failed_backups': failed_backups,
            'pending_backups': pending_backups,
            'success_rate': round((completed_backups / total_backups * 100) if total_backups > 0 else 0, 2),
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'last_backup': {
                'id': last_backup.id,
                'filename': last_backup.filename,
                'created_at': last_backup.created_at.isoformat(),
                'size_mb': round((last_backup.file_size or 0) / (1024 * 1024), 2)
            } if last_backup else None,
            'disk_usage': {
                'free_space_mb': round(free_space / (1024 * 1024), 2),
                'total_space_mb': round(total_space / (1024 * 1024), 2),
                'used_percentage': round(((total_space - free_space) / total_space * 100) if total_space > 0 else 0, 2)
            },
            'stats_by_type': stats_by_type
        }
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/verify/<int:backup_id>', methods=['GET'])
@admin_required
def verify_backup(backup_id):
    """Verifica integridade de um backup"""
    current_user_id = get_jwt_identity()
    
    try:
        backup = Backup.query.get_or_404(backup_id)
        
        if backup.status != 'completed':
            return jsonify({'error': 'Backup não está completo'}), 400
        
        verification_result = {
            'backup_id': backup_id,
            'filename': backup.filename,
            'file_exists': False,
            'size_matches': False,
            'readable': False,
            'valid': False
        }
        
        # Verificar se arquivo existe
        if backup.file_path and os.path.exists(backup.file_path):
            verification_result['file_exists'] = True
            
            # Verificar tamanho
            actual_size = os.path.getsize(backup.file_path)
            verification_result['size_matches'] = (actual_size == backup.file_size)
            verification_result['actual_size'] = actual_size
            verification_result['expected_size'] = backup.file_size
            
            # Verificar se é legível (teste básico)
            try:
                with open(backup.file_path, 'rb') as f:
                    f.read(1024)  # Ler primeiros 1KB
                verification_result['readable'] = True
            except:
                verification_result['readable'] = False
        
        # Determinar se backup é válido
        verification_result['valid'] = (
            verification_result['file_exists'] and 
            verification_result['size_matches'] and 
            verification_result['readable']
        )
        
        # Log da verificação
        AuditLog.log_action(
            user_id=current_user_id,
            action='VERIFY',
            description=f'Verificou backup: {backup.filename} (válido: {verification_result["valid"]})',
            resource_type='backup',
            resource_id=backup_id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify(verification_result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/cleanup', methods=['POST'])
@admin_required
def manual_cleanup():
    """Executa limpeza manual de backups antigos"""
    current_user_id = get_jwt_identity()
    
    try:
        data = request.get_json() or {}
        dry_run = data.get('dry_run', False)
        retention_days = data.get('retention_days', ACTIVE_CONFIG.get_retention_days('daily'))
        
        from datetime import datetime, timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        # Buscar backups antigos
        old_backups = Backup.query.filter(
            Backup.created_at < cutoff_date,
            Backup.status == 'completed'
        ).all()
        
        cleanup_result = {
            'dry_run': dry_run,
            'retention_days': retention_days,
            'cutoff_date': cutoff_date.isoformat(),
            'backups_to_remove': len(old_backups),
            'removed_backups': [],
            'errors': []
        }
        
        if not dry_run:
            from extensions import db
            
            for backup in old_backups:
                try:
                    # Remover arquivo do sistema
                    if backup.file_path and os.path.exists(backup.file_path):
                        os.remove(backup.file_path)
                    
                    cleanup_result['removed_backups'].append({
                        'id': backup.id,
                        'filename': backup.filename,
                        'created_at': backup.created_at.isoformat()
                    })
                    
                    # Remover registro do banco
                    db.session.delete(backup)
                    
                except Exception as e:
                    cleanup_result['errors'].append({
                        'backup_id': backup.id,
                        'error': str(e)
                    })
            
            if cleanup_result['removed_backups']:
                db.session.commit()
        else:
            # Dry run - apenas listar o que seria removido
            for backup in old_backups:
                cleanup_result['removed_backups'].append({
                    'id': backup.id,
                    'filename': backup.filename,
                    'created_at': backup.created_at.isoformat(),
                    'size_mb': round((backup.file_size or 0) / (1024 * 1024), 2)
                })
        
        # Log da ação
        AuditLog.log_action(
            user_id=current_user_id,
            action='CLEANUP' if not dry_run else 'CLEANUP_DRY_RUN',
            description=f'Limpeza de backups: {len(cleanup_result["removed_backups"])} itens {"removidos" if not dry_run else "identificados"}',
            resource_type='backup',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify(cleanup_result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

