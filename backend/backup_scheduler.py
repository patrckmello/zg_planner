import os
import atexit
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from flask import current_app

from backup_service import BackupService
from backup_config import ACTIVE_CONFIG
from models.user_model import User
from models.backup_model import Backup
from extensions import db


def _ensure_dir(path: str):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
    except Exception:
        pass


class BackupScheduler:
    """Gerenciador de agendamento de backups"""
    def __init__(self, app=None):
        self.app = app
        self.scheduler: BackgroundScheduler | None = None
        self.backup_service: BackupService | None = None
        self.logger = self._setup_logger()
        if app:
            self.init_app(app)

    def init_app(self, app):
        """Inicializa o agendador com a aplicação Flask"""
        self.app = app
        self.backup_service = BackupService(app)

        # Evita criar 2 schedulers no autoreload do Flask (modo debug)
        # Só inicializa no processo principal.
        if os.environ.get("WERKZEUG_RUN_MAIN") != "true" and app.config.get("ENV") != "production":
            self.logger.info("Ignorando init do scheduler no subprocess de debug.")
            return

        if self.scheduler is None:
            self.scheduler = BackgroundScheduler(
                timezone='America/Sao_Paulo',
                daemon=True,
                job_defaults={
                    'coalesce': True,
                    'max_instances': 1,
                    'misfire_grace_time': 300,  # 5 minutos
                },
            )
            self._register_default_jobs()
            self.logger.info("Scheduler instanciado.")

        # garante parada limpa ao finalizar o processo
        atexit.register(self.stop)

    def _setup_logger(self):
        """Configura logging para o scheduler"""
        logger = logging.getLogger('backup_scheduler')
        level_name = str(ACTIVE_CONFIG.LOGGING.get('level', 'INFO')).upper()
        logger.setLevel(getattr(logging, level_name, logging.INFO))

        if not logger.handlers:
            log_file = ACTIVE_CONFIG.LOGGING['file'].replace('.log', '_scheduler.log')
            _ensure_dir(log_file)
            fh = logging.FileHandler(log_file, encoding="utf-8")
            fmt = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            fh.setFormatter(fmt)
            logger.addHandler(fh)

            # opcional: também no console em dev
            sh = logging.StreamHandler()
            sh.setFormatter(fmt)
            logger.addHandler(sh)

        return logger

    def _register_default_jobs(self):
        """Registra jobs padrão de backup"""
        assert self.scheduler is not None

        self.scheduler.add_job(
            func=self._daily_backup,
            trigger=CronTrigger(hour=2, minute=0),
            id='daily_backup',
            name='Backup Diário',
            replace_existing=True
        )

        self.scheduler.add_job(
            func=self._weekly_backup,
            trigger=CronTrigger(day_of_week='sun', hour=3, minute=0),
            id='weekly_backup',
            name='Backup Semanal',
            replace_existing=True
        )

        self.scheduler.add_job(
            func=self._monthly_backup,
            trigger=CronTrigger(day='1', hour=4, minute=0),
            id='monthly_backup',
            name='Backup Mensal',
            replace_existing=True
        )

        self.scheduler.add_job(
            func=self._cleanup_old_backups,
            trigger=CronTrigger(hour=5, minute=0),
            id='cleanup_backups',
            name='Limpeza de Backups',
            replace_existing=True
        )

    def start(self):
        """Inicia o scheduler (idempotente)"""
        if not self.scheduler:
            self.logger.warning("Scheduler não inicializado. Chame init_app(app) antes de start().")
            return
        if not self.scheduler.running:
            self.scheduler.start()
            self.logger.info("Scheduler de backups INICIADO")
        else:
            self.logger.info("Scheduler de backups já estava em execução.")

    def stop(self):
        """Para o scheduler (idempotente)"""
        if self.scheduler and self.scheduler.running:
            try:
                self.scheduler.shutdown(wait=False)
                self.logger.info("Scheduler de backups PARADO")
            except Exception as e:
                self.logger.error(f"Erro ao parar scheduler: {e}")

    # ---- Jobs ----

    def _get_system_user_id(self) -> int:
        """Obtém ID de um usuário válido para registrar a autoria do backup automático."""
        with self.app.app_context():
            admin_user = User.query.filter_by(is_admin=True, is_active=True).first()
            if admin_user:
                return admin_user.id
            first_user = User.query.filter_by(is_active=True).first()
            if first_user:
                return first_user.id
            # Em último caso, 1 (se existir). Não falha o job por isso.
            return 1

    def _daily_backup(self):
        self._run_backup_job("diário")

    def _weekly_backup(self):
        self._run_backup_job("semanal")

    def _monthly_backup(self):
        self._run_backup_job("mensal")

    def _run_backup_job(self, label: str):
        try:
            assert self.backup_service is not None
            self.logger.info(f"Iniciando backup {label} automático...")
            user_id = self._get_system_user_id()
            result = self.backup_service.create_full_backup(user_id, 'full')
            if result.get('success'):
                self.logger.info(f"Backup {label} criado: {result['backup']['filename']}")
            else:
                self.logger.error(f"Erro no backup {label}: {result.get('error')}")
        except Exception as e:
            self.logger.exception(f"Erro inesperado no backup {label}: {e}")

    def _cleanup_old_backups(self):
        try:
            self.logger.info("Iniciando limpeza de backups antigos...")
            with self.app.app_context():
                retention_days = ACTIVE_CONFIG.get_retention_days('daily')
                cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

                old_backups = Backup.query.filter(
                    Backup.created_at < cutoff_date,
                    Backup.status == 'completed'
                ).all()

                removed = 0
                for b in old_backups:
                    try:
                        if b.file_path and os.path.exists(b.file_path):
                            os.remove(b.file_path)
                        db.session.delete(b)
                        removed += 1
                    except Exception as ex:
                        self.logger.error(f"Erro ao remover backup {b.id}: {ex}")

                if removed:
                    db.session.commit()
                self.logger.info(f"Limpeza concluída. Removidos: {removed}")
        except Exception as e:
            self.logger.exception(f"Erro na limpeza de backups: {e}")

    # ---- Utilidades ----

    def list_jobs(self):
        if not self.scheduler:
            return []
        return [{
            'id': j.id,
            'name': j.name,
            'next_run': j.next_run_time.isoformat() if j.next_run_time else None,
            'trigger': str(j.trigger),
        } for j in self.scheduler.get_jobs()]

    def get_job_status(self, job_id):
        try:
            job = self.scheduler.get_job(job_id) if self.scheduler else None
            if job:
                return {
                    'id': job.id,
                    'name': job.name,
                    'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                    'trigger': str(job.trigger),
                    'active': True
                }
            return {'active': False}
        except Exception as e:
            self.logger.error(f"Erro ao obter status do job {job_id}: {e}")
            return {'active': False, 'error': str(e)}


# Instância global
backup_scheduler = BackupScheduler()


def init_backup_scheduler(app):
    """Inicializa e inicia o scheduler de forma segura."""
    backup_scheduler.init_app(app)
    # Só inicia de fato no processo principal
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or app.config.get("ENV") == "production":
        backup_scheduler.start()
    return backup_scheduler
