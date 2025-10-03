import os
import pytz
from datetime import datetime, timedelta
from typing import List, Dict
from sqlalchemy import and_
from extensions import db
from models.notification_outbox_model import NotificationOutbox
from models.task_model import Task
from models.comment_model import Comment
from models.user_model import User
import logging

log = logging.getLogger("mailer.debug")

BRAZIL_TZ = pytz.timezone("America/Sao_Paulo")

STATUS_LABELS_PT = {
    "pending": "Pendente",
    "in_progress": "Em andamento",
    "done": "Concluída",
    "completed": "Concluída",
    "cancelled": "Cancelada",
    "canceled": "Cancelada",
    "blocked": "Bloqueada",
    "on_hold": "Em espera",
}

def _task_url(_: int) -> str:
    return "http://10.1.2.2:5174/tasks"

def _snippet(text: str, limit=300) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + "..."

def _first_name_from_user(u: User) -> str:
    # tenta name -> username -> prefixo do e-mail
    name = (getattr(u, "name", "") or "").strip()
    if name:
        return name.split()[0]
    username = (getattr(u, "username", "") or "").strip()
    if username:
        return username.split()[0]
    email = (getattr(u, "email", "") or "").strip()
    if email and "@" in email:
        return email.split("@")[0]
    return "Alguém"

def _format_brazil_now() -> str:
    now_utc = datetime.utcnow().replace(tzinfo=pytz.utc)
    br = now_utc.astimezone(BRAZIL_TZ)
    return br.strftime("%d/%m/%Y às %H:%M")

def _collect_recipients(task: Task, comment_author_id: int) -> List[Dict]:
    import logging
    log = logging.getLogger("mailer.debug")

    def _to_int(val):
        try:
            return int(val) if val is not None else None
        except Exception:
            return None

    def _to_int_set(values):
        out = set()
        if not values:
            return out
        for v in values:
            iv = _to_int(v)
            if iv is not None:
                out.add(iv)
        return out

    # ---- ler campos com fallbacks ----
    assigned_by_id = (
        getattr(task, "assigned_by_user_id", None)
        or getattr(task, "assigned_by_id", None)
        or _to_int(getattr(getattr(task, "assigned_by_user", None), "id", None))
    )
    assigned_by_id = _to_int(assigned_by_id)

    # responsáveis (lista):
    responsible_ids = _to_int_set(getattr(task, "assigned_users", None))

    # responsável “principal”
    primary_resp = (
        getattr(task, "assigned_to_user_id", None)
        or getattr(task, "responsible_id", None)
        or _to_int(getattr(getattr(task, "assigned_to_user", None), "id", None))
    )
    primary_resp = _to_int(primary_resp)
    if primary_resp is not None:
        responsible_ids.add(primary_resp)

    # se existir assigned_users_info
    if not responsible_ids:
        info = getattr(task, "assigned_users_info", None)
        if isinstance(info, list):
            responsible_ids |= _to_int_set([u.get("id") for u in info])

    author_id = _to_int(getattr(task, "user_id", None))

    collaborators = _to_int_set(getattr(task, "collaborators", None))
    if not collaborators:
        cinfo = getattr(task, "collaborators_info", None)
        if isinstance(cinfo, list):
            collaborators |= _to_int_set([c.get("id") for c in cinfo])

    # normalizar autor do comentário
    comment_author_id = _to_int(comment_author_id)

    # logar o que foi detectado
    log.info(
        "[MAILER] TASK FIELDS -> assigned_by_id=%s, primary_resp=%s, "
        "responsible_ids=%s, author_id=%s, collaborators=%s, comment_author_id=%s",
        assigned_by_id, primary_resp, list(responsible_ids), author_id, list(collaborators), comment_author_id
    )

    # ---- aplicar regra de negócio ----
    recipients_ids: set[int] = set()

    def add(uid):
        if uid is not None and uid != comment_author_id:
            recipients_ids.add(uid)

    is_collaborative = len(collaborators) > 0

    if is_collaborative:
        is_author_responsible = comment_author_id in responsible_ids
        is_author_collab = comment_author_id in collaborators

        if is_author_responsible:
            # responsável comentou -> colaboradores (ou autor se nenhum colaborador)
            if collaborators:
                for uid in collaborators:
                    add(uid)
            else:
                add(author_id)
        elif is_author_collab:
            # colaborador comentou -> responsáveis
            for uid in responsible_ids:
                add(uid)
        else:
            # terceiro comentou -> responsáveis + colaboradores
            for uid in responsible_ids:
                add(uid)
            for uid in collaborators:
                add(uid)

        add(author_id)
        add(assigned_by_id)

    else:
        # Equipe
        add(assigned_by_id)
        for uid in responsible_ids:
            add(uid)

    if not recipients_ids:
        return []

    users = User.query.filter(User.id.in_(list(recipients_ids))).all()
    return [{"user_id": u.id, "email": u.email} for u in users if getattr(u, "email", None)]

def enqueue_comment_email(comment_id: int):
    comment: Comment = Comment.query.filter_by(id=comment_id).first()
    if not comment:
        return

    # autor do comentário
    author: User = User.query.get(getattr(comment, "user_id", None))
    author_first_name = _first_name_from_user(author) if author else "Alguém"

    task: Task = Task.query.filter_by(id=comment.task_id).first()
    if not task:
        return

    recipients = _collect_recipients(task, getattr(comment, "user_id", None))
    log.info(f"[MAILER] Recipients p/ task={task.id} comment={comment.id}: {recipients}")
    if not recipients:
        return

    task_title = getattr(task, "title", f"Tarefa #{task.id}")
    raw_status = (getattr(task, "status", "") or "").strip().lower()
    task_status_pt = STATUS_LABELS_PT.get(raw_status, raw_status.capitalize() or "Indefinido")
    commented_at_br = _format_brazil_now()

    payload_base = {
        "subject": f"💬 {author_first_name} comentou em: {task_title}",
        "task_title": task_title,
        "task_status_pt": task_status_pt,
        "author_first_name": author_first_name,
        "commented_at": commented_at_br,
        "comment_snippet": _snippet(getattr(comment, "content", "")),
        "task_url": _task_url(task.id),
        "extra_count": 0,
    }

    now = datetime.utcnow()
    window_start = now - timedelta(minutes=2)

    for rec in recipients:
        dispatch_key = f"comment:{task.id}:{rec['user_id']}"
        existing = NotificationOutbox.query.filter(
            and_(
                NotificationOutbox.kind == "comment_email",
                NotificationOutbox.dispatch_key == dispatch_key,
                NotificationOutbox.status == "pending",
                NotificationOutbox.created_at >= window_start,
            )
        ).first()

        if existing:
            agg = existing.aggregated_comment_ids or []
            if comment.id not in agg:
                agg.append(comment.id)
                existing.aggregated_comment_ids = agg
                pb = existing.payload or {}
                pb["extra_count"] = (pb.get("extra_count") or 0) + 1
                existing.payload = pb
        else:
            db.session.add(NotificationOutbox(
                kind="comment_email",
                task_id=task.id,
                comment_id=comment.id,
                recipients=[{"user_id": rec["user_id"], "email": rec["email"]}],
                payload=payload_base,
                status="pending",
                dispatch_key=dispatch_key,
                aggregated_comment_ids=[],
            ))

    db.session.commit()
    log.info(f"[MAILER] Enfileirado: task={task.id} comment={comment.id} payload={payload_base}")
