# archive_scheduler.py
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from flask import current_app
from sqlalchemy import and_, func
from extensions import db
from models.task_model import Task
from models.audit_log_model import AuditLog

archive_scheduler = None

# Inclui variações, com/sem acento, PT/EN
ARCHIVE_STATUSES = {
    "done", "completed", "concluded",
    "concluida", "concluída",  # com e sem acento
}

def _utcnow_naive():
    return datetime.utcnow()

def archive_done_tasks_once(app, days=7):
    with app.app_context():
        cutoff = _utcnow_naive() - timedelta(days=days)

        # Normaliza para lower na consulta (evita problemas de caixa)
        status_lc = [s.lower() for s in ARCHIVE_STATUSES]

        q = Task.query.filter(
            Task.deleted_at.is_(None),
            Task.archived_at.is_(None),  # garante que só pegue não-arquivadas
            Task.completed_at.isnot(None),
            Task.completed_at < cutoff,
            func.lower(Task.status).in_(status_lc),
        )

        candidates = q.all()
        current_app.logger.info(
            f"[ARCHIVE] Cutoff={cutoff.isoformat()} | candidatos={len(candidates)}"
        )

        count = 0
        for t in candidates:
            # Segurança extra: se alguém mudou status depois, pula
            if t.archived_at:
                continue
            if hasattr(t, "mark_archived") and callable(getattr(t, "mark_archived")):
                t.mark_archived()
            else:
                setattr(t, "status", "archived")
                setattr(t, "archived_at", _utcnow_naive())
                setattr(t, "archived_by_user_id", None)

            try:
                AuditLog.log_action(
                    user_id=None,
                    action="ARCHIVE",
                    resource_type="Task",
                    resource_id=t.id,
                    description=f"Arquivamento automático (> {days} dias concluída): {t.title}",
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
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,  # tolera 1h de atraso
    )
    archive_scheduler.start()
    app.logger.info(
        f"[ARCHIVE] Scheduler iniciado (diário {hour:02d}:{minute:02d} America/Sao_Paulo)."
    )
    return archive_scheduler

def stop_archive_scheduler():
    global archive_scheduler
    if archive_scheduler:
        archive_scheduler.shutdown(wait=False)
        archive_scheduler = None
