# jobs/outbox_worker.py
from datetime import datetime
from sqlalchemy import and_
import traceback
import logging

from extensions import db
from models.notification_outbox_model import NotificationOutbox
from email_service import email_service

log = logging.getLogger("mailer.worker")

def _render_comment_email_html(payload: dict) -> str:
    task_title   = payload.get("task_title", "Tarefa")
    author_first = payload.get("author_first_name", "Alguém")
    commented_at = payload.get("commented_at", "")
    snippet      = payload.get("comment_snippet", "")
    task_status  = payload.get("task_status_pt", "Indefinido")
    task_url     = payload.get("task_url", "http://10.1.2.2:5174/tasks")
    extra_count  = int(payload.get("extra_count", 0) or 0)

    extra_html = f"""
      <div style="margin-top:8px; font-size:14px; color:#5f6368;">
        +{extra_count} comentário(s) recente(s) nesta tarefa.
      </div>
    """ if extra_count else ""

    return f"""
<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <title>[ZG Planner] Novo comentário</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background:#f2f4f7; font-family: Arial, sans-serif; color:#333;">
  <div style="max-width:600px; margin:0 auto; padding:20px;">
    <div style="background-color:#2563EB; color:#fff; padding:20px; text-align:center; border-radius:8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">ZG Planner - Novo Comentário</h2>
    </div>

    <div style="background-color:#ffffff; border:1px solid #ddd; border-top:0; padding:20px;">
      <p style="margin:0 0 10px 0; font-size:14px; color:#6b7280;">
        <span style="display:inline-block; background:#e8eefc; color:#1e3a8a; padding:4px 10px; border-radius:12px; font-weight:bold; font-size:12px;">
          {task_status}
        </span>
        <span style="margin-left:8px;">•</span>
        <span style="margin-left:8px;">{commented_at}</span>
      </p>

      <h3 style="margin:8px 0 12px 0; font-size:18px; color:#111827;">📋 {task_title}</h3>

      <div style="background:#f9f9f9; border:1px solid #e5e7eb; border-left:4px solid #2563EB; padding:14px 16px; border-radius:6px;">
        <div style="font-weight:bold; color:#111827; margin-bottom:6px;">
          {author_first} comentou:
        </div>
        <div style="font-size:14px; line-height:1.6; color:#374151;">
          {snippet}
        </div>
        {extra_html}
      </div>

      <div style="margin-top:18px;">
        <!-- Botão -->
        <a href="{task_url}" target="_blank"
           style="display:inline-block; background:#2563EB; color:#fff; text-decoration:none; padding:12px 18px; border-radius:8px; font-weight:bold; font-size:16px;">
           Abrir no ZG Planner
        </a>
      </div>

      <p style="margin:10px 0 0 0; font-size:12px; color:#6b7280;">
        Se o botão não funcionar, acesse: <a href="{task_url}" target="_blank" style="color:#2563EB;">{task_url}</a>
      </p>
    </div>

    <div style="text-align:center; margin-top:12px; font-size:12px; color:#666;">
      Este é um e-mail automático do ZG Planner. Você está recebendo porque faz parte desta tarefa.
    </div>
  </div>
</body>
</html>
"""

def process_outbox_batch(limit=25):
    now = datetime.utcnow()
    pending = NotificationOutbox.query.filter(
        and_(
            NotificationOutbox.status == "pending",
            NotificationOutbox.next_attempt_at <= now
        )
    ).order_by(NotificationOutbox.created_at.asc()).limit(limit).all()

    if not pending:
        return

    for item in pending:
        try:
            to_list = [r.get("email") for r in (item.recipients or []) if r.get("email")]
            log.info(f"[MAILER] Processando item #{item.id} kind={item.kind} to={to_list}")

            if item.kind != "comment_email":
                item.last_error = f"Kind não suportado: {item.kind}"
                item.attempts += 1
                item.schedule_next(minutes=min(item.attempts * 5, 60))
                db.session.commit()
                continue

            subject = item.payload.get("subject") or "[ZG Planner] Novo comentário"
            html = _render_comment_email_html(item.payload)

            sent_any = False
            for to_email in to_list:
                ok = email_service.send_email(to_email, subject, html, is_html=True)
                sent_any = sent_any or ok

            if sent_any:
                item.status = "sent"
            else:
                item.attempts += 1
                item.last_error = "Nenhum destinatário enviado com sucesso."
                backoff = min(2 ** min(item.attempts, 6), 60)
                item.schedule_next(minutes=backoff)

            db.session.commit()

        except Exception as e:
            item.attempts += 1
            item.last_error = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
            backoff = min(2 ** min(item.attempts, 6), 60)
            item.schedule_next(minutes=backoff)
            db.session.commit()
