# archive_scheduler.py
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from flask import current_app
from extensions import db
from models.task_model import Task
from models.audit_log_model import AuditLog

archive_scheduler = None

def archive_done_tasks_once(app, days=7):
    with app.app_context():
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        candidates = Task.query.filter(
            Task.deleted_at.is_(None),
            Task.status == 'done',
            Task.completed_at.isnot(None),
            Task.completed_at < cutoff
        ).all()

        count = 0
        for t in candidates:
            t.mark_archived()
            try:
                AuditLog.log_action(
                    user_id=None,
                    action="ARCHIVE",
                    resource_type="Task",
                    resource_id=t.id,
                    description=f"Arquivamento automático (>{days} dias concluída): {t.title}",
                )
            except Exception:
                current_app.logger.exception("Falha ao registrar auditoria (ARCHIVE auto)")
            count += 1
        if count:
            db.session.commit()
        current_app.logger.info(f"[ARCHIVE] Arquivadas {count} tarefa(s).")
        return count

def init_archive_scheduler(app, hour=3, minute=45):
    global archive_scheduler
    if archive_scheduler:
        return archive_scheduler

    archive_scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")
    archive_scheduler.add_job(
        func=lambda: archive_done_tasks_once(app),
        trigger="cron",
        hour=hour,
        minute=minute,
        id="archive_done_daily",
        replace_existing=True,
    )
    archive_scheduler.start()
    app.logger.info("[ARCHIVE] Scheduler iniciado (diário).")
    return archive_scheduler

def stop_archive_scheduler():
    global archive_scheduler
    if archive_scheduler:
        archive_scheduler.shutdown(wait=False)
        archive_scheduler = None
