from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.dialects.postgresql import JSON
from extensions import db

class NotificationOutbox(db.Model):
    __tablename__ = "notification_outbox"

    id = Column(Integer, primary_key=True)
    kind = Column(String(50), nullable=False)

    # antes: nullable=False
    task_id = Column(Integer, nullable=True, index=True)

    # novo: para notificações que não têm task (ex.: reset de senha)
    user_id = Column(Integer, nullable=True, index=True)

    comment_id = Column(Integer, nullable=True)
    recipients = Column(JSON, nullable=False, default=list)
    payload = Column(JSON, nullable=False, default=dict)
    status = Column(String(20), nullable=False, default="pending")
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    next_attempt_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    dispatch_key = Column(String(255), nullable=True, index=True)
    aggregated_comment_ids = Column(JSON, nullable=True, default=list)

    def schedule_next(self, minutes=0):
        self.next_attempt_at = datetime.utcnow() + timedelta(minutes=minutes)

    # ---------- helpers ----------
    @staticmethod
    def enqueue_email(
        *,
        kind: str,
        recipients: list[dict],
        subject: str,
        body: str,
        is_html: bool = True,
        dispatch_key: str | None = None,
        extra_payload: dict | None = None,
        task_id: int | None = None,
        user_id: int | None = None,
        comment_id: int | None = None,
    ):
        if not recipients:
            return

        if task_id is None and user_id is None:
            raise ValueError("NotificationOutbox.enqueue_email: informe task_id ou user_id.")

        payload = {"subject": subject, "body": body, "is_html": is_html}
        if extra_payload:
            payload.update(extra_payload)

        for r in recipients:
            db.session.add(NotificationOutbox(
                kind=kind,
                task_id=task_id,
                user_id=user_id,
                comment_id=comment_id,
                recipients=[r],
                payload=payload,
                status="pending",
                dispatch_key=dispatch_key
            ))
        db.session.commit()