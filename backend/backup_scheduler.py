import os
import atexit
import logging
from datetime import datetime, timedelta, time as _time, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

from backup_service import BackupService
from backup_config import ACTIVE_CONFIG
from models.user_model import User
from models.backup_model import Backup
from email_service import email_service
from extensions import db

# ===== timezone BR robusto =====
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
    TZ_BR = ZoneInfo("America/Sao_Paulo")
except Exception:
    import pytz
    TZ_BR = pytz.timezone("America/Sao_Paulo")


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
                timezone="America/Sao_Paulo",
                daemon=True,
                job_defaults={
                    "coalesce": True,
                    "max_instances": 1,
                    "misfire_grace_time": 300,  # 5 minutos
                },
            )
            self._register_default_jobs()

            # Em DEV, opcional: agenda um disparo único em 2 min para teste do e-mail de backup
            if (app.config.get("ENV") != "production") and bool(int(os.getenv("BACKUP_TEST_ON_BOOT", "0"))):
                run_date = (datetime.now(TZ_BR) + timedelta(minutes=2)) if TZ_BR else (datetime.now() + timedelta(minutes=2))
                self.scheduler.add_job(
                    func=self._email_weekly_backup,
                    trigger=DateTrigger(run_date=run_date),
                    id="email_weekly_backup_test_once",
                    name="[TESTE] Envio de backup (2min)",
                    replace_existing=True,
                )

            self.logger.info("Scheduler instanciado.")

        # garante parada limpa ao finalizar o processo
        atexit.register(self.stop)

    def _setup_logger(self):
        """Configura logging para o scheduler"""
        logger = logging.getLogger("backup_scheduler")
        level_name = str(ACTIVE_CONFIG.LOGGING.get("level", "INFO")).upper()
        logger.setLevel(getattr(logging, level_name, logging.INFO))

        if not logger.handlers:
            log_file = ACTIVE_CONFIG.LOGGING["file"].replace(".log", "_scheduler.log")
            _ensure_dir(log_file)
            fh = logging.FileHandler(log_file, encoding="utf-8")
            fmt = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
            fh.setFormatter(fmt)
            logger.addHandler(fh)

            # opcional: também no console em dev
            sh = logging.StreamHandler()
            sh.setFormatter(fmt)
            logger.addHandler(sh)

        return logger

    def _register_default_jobs(self):
        assert self.scheduler is not None

        self.scheduler.add_job(
            func=self._daily_backup,
            trigger=CronTrigger(hour=2, minute=0),
            id="daily_backup",
            name="Backup Diário",
            replace_existing=True,
        )
        self.scheduler.add_job(
            func=self._weekly_backup,
            trigger=CronTrigger(day_of_week="sun", hour=3, minute=0),
            id="weekly_backup",
            name="Backup Semanal",
            replace_existing=True,
        )
        self.scheduler.add_job(
            func=self._monthly_backup,
            trigger=CronTrigger(day="1", hour=4, minute=0),
            id="monthly_backup",
            name="Backup Mensal",
            replace_existing=True,
        )
        self.scheduler.add_job(
            func=self._cleanup_old_backups,
            trigger=CronTrigger(hour=5, minute=0),
            id="cleanup_backups",
            name="Limpeza de Backups",
            replace_existing=True,
        )
        self.scheduler.add_job(
            func=self._email_weekly_backup,
            trigger=CronTrigger(day_of_week="fri", hour=17, minute=30),
            id="email_weekly_backup",
            name="Envio Semanal de Backup por E-mail",
            replace_existing=True,
        )

    def start(self):
        """Inicia o scheduler (idempotente)"""
        if not self.scheduler:
            self.logger.warning("Scheduler não inicializado. Chame init_app(app) antes de start().")
            return

        if not self.scheduler.running:
            self.scheduler.start()
            self.logger.info("Scheduler de backups INICIADO")

            # --- CATCH-UP opcional (controlado por ENV) ---
            try:
                catchup_enabled = os.getenv("BACKUP_CATCHUP_ENABLED", "1").lower() in ("1", "true", "yes", "on")
                if catchup_enabled:
                    now_br = datetime.now(TZ_BR) if TZ_BR else datetime.now()
                    if now_br.weekday() == 4 and now_br.time() >= _time(17, 30):  # sexta, pós 17:30 BRT/BRST
                        with self.app.app_context():
                            if self._already_sent_weekly_today():
                                self.logger.info("[CATCHUP] Já houve envio semanal hoje; não repetindo.")
                            else:
                                self.logger.info("[CATCHUP] Sexta pós 17:30 (BRT) e ainda não houve envio hoje. Disparando 1x agora.")
                                try:
                                    self._email_weekly_backup()
                                except Exception:
                                    self.logger.exception("Falha no catch-up do envio semanal.")
                else:
                    self.logger.info("[CATCHUP] Desativado por BACKUP_CATCHUP_ENABLED=0")
            except Exception:
                self.logger.exception("Erro ao avaliar catch-up do envio semanal.")

            # Loga próximos disparos
            try:
                for j in self.list_jobs():
                    self.logger.info(f"[JOB] {j['id']} | {j['name']} | next_run={j['next_run']} | trigger={j['trigger']}")
            except Exception:
                pass
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
        """ID determinístico para autoria de backups automáticos."""
        with self.app.app_context():
            # 1) ENV configurável
            try:
                env_id = int(os.getenv("BACKUP_SYSTEM_USER_ID", "").strip() or 0)
                if env_id:
                    u = User.query.get(env_id)
                    if u and u.is_active:
                        return u.id
            except Exception:
                pass

            # 2) Service account fixa por e-mail
            svc_email = os.getenv("BACKUP_SYSTEM_EMAIL", "backup@system.local")
            svc = User.query.filter_by(email=svc_email).first()
            if not svc:
                try:
                    svc = User(
                        username="Backup Service",
                        email=svc_email,
                        is_active=True,
                        is_admin=True,  # opcional
                    )
                    db.session.add(svc)
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    svc = User.query.filter_by(email=svc_email).first()
            if svc and svc.is_active:
                return svc.id

            # 3) Fallback: primeiro admin por ID
            admin = User.query.filter_by(is_admin=True, is_active=True).order_by(User.id.asc()).first()
            if admin:
                return admin.id

            # 4) Primeiro usuário ativo
            first_user = User.query.filter_by(is_active=True).order_by(User.id.asc()).first()
            if first_user:
                return first_user.id

            # 5) Zero = “sem usuário”
            return 0

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
            result = self.backup_service.create_full_backup(user_id, "full")
            if result.get("success"):
                self.logger.info(f"Backup {label} criado: {result['backup']['filename']}")
            else:
                self.logger.error(f"Erro no backup {label}: {result.get('error')}")
        except Exception as e:
            self.logger.exception(f"Erro inesperado no backup {label}: {e}")

    def _cleanup_old_backups(self):
        try:
            self.logger.info("Iniciando limpeza de backups antigos...")
            with self.app.app_context():
                retention_days = int(os.getenv("BACKUP_RETENTION_DAYS", "7"))
                cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

                old_backups = Backup.query.filter(
                    Backup.created_at < cutoff_date,
                    Backup.status == "completed",
                ).all()

                removed = 0
                for b in old_backups:
                    try:
                        if b.file_path and os.path.exists(b.file_path):
                            os.remove(b.file_path)
                        db.session.delete(b)
                        removed += 1
                    except Exception as ex:
                        self.logger.error(f"Erro ao remover backup {getattr(b, 'id', '?')}: {ex}")

                if removed:
                    db.session.commit()
                self.logger.info(f"Limpeza concluída. Removidos: {removed}")
        except Exception as e:
            self.logger.exception(f"Erro na limpeza de backups: {e}")

    def _email_weekly_backup(self):
        """Envia, 1x por semana, o backup 'completed' mais recente para o destinatário definido."""
        try:
            recipient = os.getenv("BACKUP_EMAIL_RECIPIENT", "ti@zavagnagralha.com.br")
            with self.app.app_context():
                latest = (
                    Backup.query.filter_by(status="completed")
                    .order_by(Backup.created_at.desc())
                    .first()
                )
                if not latest or not latest.file_path or not os.path.exists(latest.file_path):
                    self.logger.warning("Nenhum backup completo disponível para envio semanal.")
                    return

                filename = latest.filename
                size_mb = round((latest.file_size or os.path.getsize(latest.file_path)) / (1024 * 1024), 2)

                admin_url = os.getenv("BACKUP_PANEL_URL")  # opcional

                ok = email_service.send_backup_weekly(
                    to_email=recipient,
                    filename=filename,
                    created_at_utc=latest.created_at,
                    file_size_bytes=(latest.file_size or os.path.getsize(latest.file_path)),
                    attachment_path=latest.file_path,
                    admin_url=admin_url
                )

                # Marca em AuditLog para idempotência diária do catch-up
                self._mark_weekly_sent(filename, recipient, ok)

                if ok:
                    self.logger.info(f"Backup '{filename}' enviado por e-mail para {recipient}.")
                else:
                    self.logger.error(f"Falha ao enviar backup '{filename}' para {recipient}.")
        except Exception as e:
            self.logger.exception(f"Erro no envio semanal de backup: {e}")

    # ---- Utilidades ----

    def list_jobs(self):
        if not self.scheduler:
            return []
        return [
            {
                "id": j.id,
                "name": j.name,
                "next_run": j.next_run_time.isoformat() if j.next_run_time else None,
                "trigger": str(j.trigger),
            }
            for j in self.scheduler.get_jobs()
        ]

    def get_job_status(self, job_id):
        try:
            job = self.scheduler.get_job(job_id) if self.scheduler else None
            if job:
                return {
                    "id": job.id,
                    "name": job.name,
                    "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                    "trigger": str(job.trigger),
                    "active": True,
                }
            return {"active": False}
        except Exception as e:
            self.logger.error(f"Erro ao obter status do job {job_id}: {e}")
            return {"active": False, "error": str(e)}

    def trigger_test_email_once(self, minutes_from_now: int = 2):
        """Agenda um disparo único de _email_weekly_backup para teste."""
        if not self.scheduler:
            raise RuntimeError("Scheduler não inicializado")
        run_date = (datetime.now(TZ_BR) + timedelta(minutes=minutes_from_now)) if TZ_BR else (datetime.now() + timedelta(minutes=minutes_from_now))
        self.scheduler.add_job(
            func=self._email_weekly_backup,
            trigger=DateTrigger(run_date=run_date),
            id="email_weekly_backup_test_once",
            name="[TESTE] Envio de backup (one-shot)",
            replace_existing=True,
        )
        self.logger.info(f"[TESTE] Agendado envio único de backup para {run_date.isoformat()}")

    # ===== Helpers de idempotência (AuditLog) =====

    def _already_sent_weekly_today(self) -> bool:
        """
        Verifica em AuditLog se já houve envio semanal hoje (dia BRT).
        Evita catch-up múltiplo a cada restart.
        """
        try:
            from models.audit_log_model import AuditLog  # import tardio
            # início/fim do dia BRT
            now_br = datetime.now(TZ_BR) if TZ_BR else datetime.now()
            start_br = now_br.replace(hour=0, minute=0, second=0, microsecond=0)
            end_br = now_br.replace(hour=23, minute=59, second=59, microsecond=999999)

            # Converte janelas para UTC naive (compatível com colunas UTC naive)
            start_utc = start_br.astimezone(timezone.utc).replace(tzinfo=None)
            end_utc = end_br.astimezone(timezone.utc).replace(tzinfo=None)

            q = (
                AuditLog.query.filter(
                    AuditLog.action.in_(["WEEKLY_BACKUP_EMAIL", "EMAIL_WEEKLY_BACKUP"]),
                    AuditLog.created_at >= start_utc,
                    AuditLog.created_at <= end_utc,
                )
                .order_by(AuditLog.created_at.desc())
                .first()
            )
            return q is not None
        except Exception:
            # na dúvida, não bloquear
            return False

    def _mark_weekly_sent(self, filename: str, recipient: str, ok: bool):
        """Escreve um log de auditoria para marcarmos 'enviado hoje'."""
        try:
            from models.audit_log_model import AuditLog
            AuditLog.log_action(
                user_id=0,  # sistema
                action="WEEKLY_BACKUP_EMAIL",
                description=f"Envio semanal {'OK' if ok else 'FALHOU'}: {filename} para {recipient}",
                resource_type="backup",
                resource_id=None,
                ip_address=None,
                user_agent="scheduler",
            )
        except Exception:
            pass


# Instância global
backup_scheduler = BackupScheduler()


def init_backup_scheduler(app):
    """Inicializa e inicia o scheduler de forma segura."""
    backup_scheduler.init_app(app)
    # Só inicia de fato no processo principal
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or app.config.get("ENV") == "production":
        backup_scheduler.start()
    return backup_scheduler
