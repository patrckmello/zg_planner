# purge_scheduler.py
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from flask import current_app
from sqlalchemy import func
from extensions import db
from models.task_model import Task
from models.audit_log_model import AuditLog
import os

scheduler = None

def _utcnow_naive():
    return datetime.utcnow()

def _delete_task_files(task):
    """Apaga do disco os arquivos de anexos (se houver)."""
    try:
        upload_dir = current_app.config.get("UPLOAD_FOLDER")
        if not upload_dir:
            return
        for anexo in (task.anexos or []):
            # aceita dict {"name": "..."} ou {"path": "..."} ou {"url": "..."} ou string
            name = None
            if isinstance(anexo, dict):
                name = anexo.get("name") or anexo.get("path") or anexo.get("url")
            else:
                name = str(anexo)

            if not name:
                continue

            # se veio URL, tenta extrair o nome do arquivo
            if "://" in name:
                name = name.rsplit("/", 1)[-1]

            path = os.path.join(upload_dir, name)
            # garante que não sai da pasta de uploads
            try:
                os.path.commonpath([os.path.abspath(path), os.path.abspath(upload_dir)])
            except Exception:
                continue

            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
    except Exception:
        current_app.logger.exception("Falha ao apagar anexos no purge")

def purge_trash_once(app, days=7):
    """Apaga definitivamente tasks na lixeira com > N dias."""
    with app.app_context():
        cutoff = _utcnow_naive() - timedelta(days=days)

        # LOG de diagnóstico útil
        current_app.logger.info(f"[PURGE] Rodando com cutoff={cutoff.isoformat()} (UTC naive)")

        # deleted_at também é UTC naive (Task.soft_delete usa datetime.utcnow())
        old_tasks = Task.query.filter(
            Task.deleted_at.isnot(None),
            Task.deleted_at < cutoff
        ).all()

        current_app.logger.info(f"[PURGE] Candidatos encontrados: {len(old_tasks)}")

        count = 0
        for t in old_tasks:
            # apaga arquivos vinculados
            _delete_task_files(t)

            # auditoria antes de deletar
            try:
                AuditLog.log_action(
                    user_id=t.deleted_by_user_id,
                    action="PURGE",
                    resource_type="Task",
                    resource_id=t.id,
                    description=f"Exclusão permanente automática (>{days} dias na lixeira): {t.title}",
                )
            except Exception:
                current_app.logger.exception("Falha ao registrar auditoria (PURGE auto)")

            db.session.delete(t)
            count += 1

        if count:
            db.session.commit()

        current_app.logger.info(f"[PURGE] Removidas definitivamente {count} tarefa(s).")
        return count

def init_purge_scheduler(app, hour=3, minute=30):
    """Agenda execução diária (ex.: 03:30 America/Sao_Paulo)."""
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
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,  # tolera 1h de atraso
    )
    scheduler.start()
    app.logger.info(f"[PURGE] Scheduler iniciado (diário {hour:02d}:{minute:02d} America/Sao_Paulo).")
    return scheduler

def stop_purge_scheduler():
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
