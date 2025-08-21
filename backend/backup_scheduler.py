"""
Sistema de agendamento de backups para ZG Planner
Suporte para backups automáticos usando APScheduler
"""

import os
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from backup_service import BackupService
from backup_config import ACTIVE_CONFIG
from models.user_model import User
from models.backup_model import Backup
from extensions import db

class BackupScheduler:
    """Gerenciador de agendamento de backups"""
    
    def __init__(self, app=None):
        self.app = app
        self.scheduler = None
        self.backup_service = None
        self.logger = self._setup_logger()
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Inicializa o agendador com a aplicação Flask"""
        self.app = app
        self.backup_service = BackupService(app)
        
        # Configurar scheduler
        self.scheduler = BackgroundScheduler(
            timezone='America/Sao_Paulo',  # Ajuste conforme necessário
            job_defaults={
                'coalesce': True,
                'max_instances': 1,
                'misfire_grace_time': 300  # 5 minutos
            }
        )
        
        # Registrar jobs padrão
        self._register_default_jobs()
    
    def _setup_logger(self):
        """Configura logging para o scheduler"""
        logger = logging.getLogger('backup_scheduler')
        logger.setLevel(getattr(logging, ACTIVE_CONFIG.LOGGING['level']))
        
        # Handler para arquivo
        if not logger.handlers:
            log_file = ACTIVE_CONFIG.LOGGING['file'].replace('.log', '_scheduler.log')
            handler = logging.FileHandler(log_file)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _register_default_jobs(self):
        """Registra jobs padrão de backup"""
        
        # Backup diário às 2:00
        self.scheduler.add_job(
            func=self._daily_backup,
            trigger=CronTrigger(hour=2, minute=0),
            id='daily_backup',
            name='Backup Diário',
            replace_existing=True
        )
        
        # Backup semanal aos domingos às 3:00
        self.scheduler.add_job(
            func=self._weekly_backup,
            trigger=CronTrigger(day_of_week=0, hour=3, minute=0),
            id='weekly_backup',
            name='Backup Semanal',
            replace_existing=True
        )
        
        # Backup mensal no dia 1 às 4:00
        self.scheduler.add_job(
            func=self._monthly_backup,
            trigger=CronTrigger(day=1, hour=4, minute=0),
            id='monthly_backup',
            name='Backup Mensal',
            replace_existing=True
        )
        
        # Limpeza de backups antigos diariamente às 5:00
        self.scheduler.add_job(
            func=self._cleanup_old_backups,
            trigger=CronTrigger(hour=5, minute=0),
            id='cleanup_backups',
            name='Limpeza de Backups',
            replace_existing=True
        )
    
    def start(self):
        """Inicia o scheduler"""
        if self.scheduler and not self.scheduler.running:
            self.scheduler.start()
            self.logger.info("Scheduler de backups iniciado")
    
    def stop(self):
        """Para o scheduler"""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown()
            self.logger.info("Scheduler de backups parado")
    
    def _get_system_user_id(self):
        """Obtém ID do usuário sistema para backups automáticos"""
        with self.app.app_context():
            # Procurar usuário admin ou criar usuário sistema
            admin_user = User.query.filter_by(is_admin=True).first()
            if admin_user:
                return admin_user.id
            
            # Se não houver admin, usar o primeiro usuário ativo
            first_user = User.query.filter_by(is_active=True).first()
            if first_user:
                return first_user.id
            
            # Fallback: retornar 1 (assumindo que existe)
            return 1
    
    def _daily_backup(self):
        """Executa backup diário"""
        try:
            self.logger.info("Iniciando backup diário automático")
            user_id = self._get_system_user_id()
            
            result = self.backup_service.create_full_backup(user_id, 'full')
            
            if result['success']:
                self.logger.info(f"Backup diário criado: {result['backup']['filename']}")
            else:
                self.logger.error(f"Erro no backup diário: {result['error']}")
                
        except Exception as e:
            self.logger.error(f"Erro inesperado no backup diário: {e}")
    
    def _weekly_backup(self):
        """Executa backup semanal"""
        try:
            self.logger.info("Iniciando backup semanal automático")
            user_id = self._get_system_user_id()
            
            result = self.backup_service.create_full_backup(user_id, 'full')
            
            if result['success']:
                self.logger.info(f"Backup semanal criado: {result['backup']['filename']}")
            else:
                self.logger.error(f"Erro no backup semanal: {result['error']}")
                
        except Exception as e:
            self.logger.error(f"Erro inesperado no backup semanal: {e}")
    
    def _monthly_backup(self):
        """Executa backup mensal"""
        try:
            self.logger.info("Iniciando backup mensal automático")
            user_id = self._get_system_user_id()
            
            result = self.backup_service.create_full_backup(user_id, 'full')
            
            if result['success']:
                self.logger.info(f"Backup mensal criado: {result['backup']['filename']}")
            else:
                self.logger.error(f"Erro no backup mensal: {result['error']}")
                
        except Exception as e:
            self.logger.error(f"Erro inesperado no backup mensal: {e}")
    
    def _cleanup_old_backups(self):
        """Remove backups antigos baseado na política de retenção"""
        try:
            self.logger.info("Iniciando limpeza de backups antigos")
            
            with self.app.app_context():
                # Obter política de retenção
                retention_days = ACTIVE_CONFIG.get_retention_days('daily')
                cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
                
                # Buscar backups antigos
                old_backups = Backup.query.filter(
                    Backup.created_at < cutoff_date,
                    Backup.status == 'completed'
                ).all()
                
                removed_count = 0
                for backup in old_backups:
                    try:
                        # Remover arquivo do sistema
                        if backup.file_path and os.path.exists(backup.file_path):
                            os.remove(backup.file_path)
                        
                        # Remover registro do banco
                        db.session.delete(backup)
                        removed_count += 1
                        
                    except Exception as e:
                        self.logger.error(f"Erro ao remover backup {backup.id}: {e}")
                
                if removed_count > 0:
                    db.session.commit()
                    self.logger.info(f"Removidos {removed_count} backups antigos")
                else:
                    self.logger.info("Nenhum backup antigo para remover")
                    
        except Exception as e:
            self.logger.error(f"Erro na limpeza de backups: {e}")
    
    def add_custom_job(self, func, trigger, job_id, name=None, **kwargs):
        """Adiciona job customizado"""
        try:
            self.scheduler.add_job(
                func=func,
                trigger=trigger,
                id=job_id,
                name=name or job_id,
                replace_existing=True,
                **kwargs
            )
            self.logger.info(f"Job customizado adicionado: {job_id}")
            return True
        except Exception as e:
            self.logger.error(f"Erro ao adicionar job {job_id}: {e}")
            return False
    
    def remove_job(self, job_id):
        """Remove job específico"""
        try:
            self.scheduler.remove_job(job_id)
            self.logger.info(f"Job removido: {job_id}")
            return True
        except Exception as e:
            self.logger.error(f"Erro ao remover job {job_id}: {e}")
            return False
    
    def list_jobs(self):
        """Lista todos os jobs agendados"""
        if not self.scheduler:
            return []
        
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                'id': job.id,
                'name': job.name,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                'trigger': str(job.trigger)
            })
        
        return jobs
    
    def get_job_status(self, job_id):
        """Obtém status de um job específico"""
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                return {
                    'id': job.id,
                    'name': job.name,
                    'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                    'trigger': str(job.trigger),
                    'active': True
                }
            else:
                return {'active': False}
        except Exception as e:
            self.logger.error(f"Erro ao obter status do job {job_id}: {e}")
            return {'active': False, 'error': str(e)}

# Instância global do scheduler
backup_scheduler = BackupScheduler()

def init_backup_scheduler(app):
    """Inicializa o scheduler com a aplicação"""
    backup_scheduler.init_app(app)
    return backup_scheduler

