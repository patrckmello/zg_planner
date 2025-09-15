from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from flask import current_app
from extensions import db
from models.task_model import Task
from models.audit_log_model import AuditLog
import os

scheduler = None

def _delete_task_files(task):
    """Apaga do disco os arquivos de anexos (se houver)."""
    try:
        upload_dir = current_app.config.get("UPLOAD_FOLDER")
        if not upload_dir:
            return
        for anexo in (task.anexos or []):
            name = anexo.get("name") if isinstance(anexo, dict) else str(anexo)
            if not name:
                continue
            path = os.path.join(upload_dir, name)
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
    except Exception:
        # não deixa o purge quebrar por falha ao apagar arquivo
        current_app.logger.exception("Falha ao apagar anexos no purge")

def purge_trash_once(app, days=7):
    """Executa UMA varredura: apaga definitivamente tasks na lixeira com +N dias."""
    with app.app_context():
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        # deleted_at pode ser naive na sua base; se for, use datetime.utcnow() e compare sem tz.
        old_tasks = Task.query.filter(
            Task.deleted_at.isnot(None),
            Task.deleted_at < cutoff
        ).all()

        count = 0
        for t in old_tasks:
            # apaga arquivos
            _delete_task_files(t)
            # auditoria antes de deletar
            try:
                AuditLog.log_action(
                    user_id=t.deleted_by_user_id,  # quem moveu pra lixeira (se existir)
                    action="PURGE",
                    resource_type="Task",
                    resource_id=t.id,
                    description=f"Exclusão permanente automática (>{days} dias na lixeira): {t.title}",
                )
            except Exception:
                current_app.logger.exception("Falha ao registrar auditoria (PURGE auto)")
            # remove do banco
            db.session.delete(t)
            count += 1

        db.session.commit()
        current_app.logger.info(f"[PURGE] Removidas definitivamente {count} tarefa(s).")
        return count

def init_purge_scheduler(app, hour=3, minute=30):
    """Agenda execução diária (ex.: 03:30)"""
    global scheduler
    if scheduler:
        return scheduler

    scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")
    scheduler.add_job(
        func=lambda: purge_trash_once(app),
        trigger="cron",
        hour=hour,
        minute=minute,
        id="purge_trash_daily",
        replace_existing=True,
    )
    scheduler.start()
    app.logger.info("[PURGE] Scheduler iniciado (diário).")
    return scheduler

def stop_purge_scheduler():
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None