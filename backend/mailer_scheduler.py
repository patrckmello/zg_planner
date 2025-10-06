# mailer_scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from jobs.outbox_worker import process_outbox_batch

_scheduler = None

def init_mailer_scheduler(app):
    global _scheduler
    if _scheduler:
        return _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        func=lambda: _run_job_safe(app),
        trigger="interval",
        seconds=60,
        id="outbox_mailer",
        max_instances=1,
        coalesce=True
    )
    _scheduler.start()
    return _scheduler

def stop_mailer_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None

def _run_job_safe(app):
    with app.app_context():
        process_outbox_batch()
