# models/notification_outbox_model.py
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.dialects.postgresql import JSON
from extensions import db

class NotificationOutbox(db.Model):
    __tablename__ = "notification_outbox"

    id = Column(Integer, primary_key=True)
    kind = Column(String(50), nullable=False)
    task_id = Column(Integer, nullable=False)
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
