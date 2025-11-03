import os
import html
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional
from zoneinfo import ZoneInfo
from flask import current_app

from extensions import db
from models.task_model import Task
from models.user_model import User
from services.ms_graph_delegated import create_event_as_user
from services.ms_graph_delegated import update_event_as_user, delete_event_as_user
# ------------------------------------------------------------
# Config
# ------------------------------------------------------------

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://10.1.2.2:5174")
DEFAULT_TZ = os.getenv("DEFAULT_TZ", "America/Sao_Paulo")


# ------------------------------------------------------------
# Helpers de data/tempo
# ------------------------------------------------------------

def _minutes_from_task(task: Task) -> int:
    """Converte os campos tempo_estimado/tempo_unidade em minutos, com defaults sensatos."""
    if not getattr(task, "tempo_estimado", None):
        return 30
    try:
        q = int(task.tempo_estimado)
    except Exception:
        return 30
    unidade = (getattr(task, "tempo_unidade", None) or "horas").lower()
    if unidade == "minutos":
        return max(q, 5)
    return max(q * 60, 15)


def _iso_local(dt: datetime) -> str:
    """Formato ISO sem offset (Graph usa timeZone separado)."""
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _as_local_from_utc(dt: datetime, tz_name: str) -> datetime:
    """
    Interpreta dt naive como UTC e converte para timezone local; se tz-aware, apenas converte.
    """
    tz_local = ZoneInfo(tz_name)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).astimezone(tz_local)
    return dt.astimezone(tz_local)


# ------------------------------------------------------------
# Helpers diversos
# ------------------------------------------------------------
def _compute_times_for_task_local(task: Task) -> tuple[datetime, datetime]:
    start_local = _as_local_from_utc(task.due_date, DEFAULT_TZ)
    mins = _minutes_from_task(task)
    end_local = start_local + timedelta(minutes=mins)
    if end_local <= start_local:
        end_local = start_local + timedelta(minutes=30)
    return start_local, end_local

def ensure_event_for_task(task: Task, actor_user_id: int) -> dict | None:
    """
    Cria ou atualiza o evento vinculado à task. Salva ms_event_id/etag/last_sync.
    """
    if not task.due_date:
        return None

    start_local, end_local = _compute_times_for_task_local(task)
    subject = f"[ZG Planner] {getattr(task, 'title', '')}"
    task_url = f"{FRONTEND_BASE_URL}/tasks/{task.id}"
    location = (getattr(task, "categoria", None) or "")[:64]

    attendee_ids = set(getattr(task, "assigned_users", None) or [])
    attendee_ids.update(getattr(task, "collaborators", None) or [])
    if getattr(task, "assigned_by_user_id", None):
        attendee_ids.add(int(task.assigned_by_user_id))
    attendees_emails = _emails_by_ids(attendee_ids)

    body_html = build_event_body_html(
        task=task,
        task_url=task_url,
        start_local=start_local,
        end_local=end_local,
        tz_name=DEFAULT_TZ,
        attendees_emails=attendees_emails
    )

    if task.ms_event_id:
        ev = update_event_as_user(
            user_id=actor_user_id,
            event_id=task.ms_event_id,
            subject=subject,
            start_iso=_iso_local(start_local),
            end_iso=_iso_local(end_local),
            timezone_str=DEFAULT_TZ,
            attendees=attendees_emails,
            body_html=body_html,
            location=location,
            etag=task.ms_event_etag,
            calendar_id=task.ms_calendar_id or "primary"
        )
        task.ms_event_etag  = ev.get("@odata.etag") or ev.get("etag") or task.ms_event_etag
        task.ms_last_sync   = datetime.now(timezone.utc)
        task.ms_sync_status = "ok"
        return ev
    else:
        ev = create_event_as_user(
            user_id=actor_user_id,
            subject=subject,
            start_iso=_iso_local(start_local),
            end_iso=_iso_local(end_local),
            timezone_str=DEFAULT_TZ,
            attendees=attendees_emails,
            body_html=body_html,
            location=location
        )
        task.ms_event_id    = ev.get("id")
        task.ms_calendar_id = "primary"
        task.ms_event_etag  = ev.get("@odata.etag") or ev.get("etag")
        task.ms_last_sync   = datetime.now(timezone.utc)
        task.ms_sync_status = "ok"
        return ev

def delete_event_for_task(task: Task, actor_user_id: int) -> None:
    if not task.ms_event_id:
        return
    try:
        delete_event_as_user(
            user_id=actor_user_id,
            event_id=task.ms_event_id,
            etag=task.ms_event_etag,
            calendar_id=task.ms_calendar_id or "primary"
        )
    finally:
        task.ms_event_id    = None
        task.ms_event_etag  = None
        task.ms_sync_status = "deleted"
        task.ms_last_sync   = datetime.now(timezone.utc)

def _emails_by_ids(user_ids: Iterable[int]) -> list[str]:
    ids = list({int(x) for x in (user_ids or [])})
    if not ids:
        return []
    users = User.query.filter(User.id.in_(ids)).all()
    out, seen = [], set()
    for u in users:
        if not u or not u.email:
            continue
        e = u.email.lower()
        if e in seen:
            continue
        seen.add(e)
        out.append(u.email)
    return out


def _safe_get(d: object, key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Acessa atributo/chave com segurança tanto para objetos quanto dicts.
    """
    if isinstance(d, dict):
        return d.get(key, default)
    return getattr(d, key, default)


def _escape(s: Optional[str]) -> str:
    return html.escape((s or "").strip())


def _nl2br(s: Optional[str]) -> str:
    return _escape(s).replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")


def _format_dt_human(dt: datetime, tz_name: str) -> str:
    """Ex.: 09 out 2025, 17:00 (BRT)"""
    tz = ZoneInfo(tz_name)
    if dt.tzinfo is None:
        dt_local = dt.replace(tzinfo=timezone.utc).astimezone(tz)
    else:
        dt_local = dt.astimezone(tz)
    mes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][dt_local.month - 1]
    offset = dt_local.strftime("%z")  # ex.: -0300
    tz_short = "BRT" if offset == "-0300" else f"UTC{offset[:3]}:{offset[3:]}"
    return f"{dt_local.day:02d} {mes} {dt_local.year}, {dt_local:%H:%M} ({tz_short})"


def _badge(text: str, bg="#e8f2ff", fg="#1a2b3c", border="#cfe2ff") -> str:
    return f'''<span style="display:inline-block;padding:2px 8px;border:1px solid {border};
      border-radius:999px;background:{bg};color:{fg};font-size:12px;line-height:18px;margin-right:6px;">
      { _escape(text) }
    </span>'''


def _chip(text: str) -> str:
    return _badge(text, bg="#f4f6f8", fg="#334155", border="#e5e7eb")


def _priority_badge(p: Optional[str]) -> str:
    p = (p or "").lower()
    if p in ("alta", "high", "urgent", "urgente"):
        return _badge("Prioridade: Alta", bg="#ffe8e8", fg="#7f1d1d", border="#ffc9c9")
    if p in ("media", "média", "medium"):
        return _badge("Prioridade: Média", bg="#fff6e5", fg="#7a4a00", border="#ffe0a6")
    if p in ("baixa", "low"):
        return _badge("Prioridade: Baixa", bg="#e8fff3", fg="#065f46", border="#b7f0d0")
    return ""


def _status_badge(s: Optional[str]) -> str:
    s = (s or "").lower()
    mapping = {
        "pending": ("Pendente", "#eef2ff", "#312e81", "#c7d2fe"),
        "in_progress": ("Em andamento", "#e6fffb", "#155e75", "#b2f1ea"),
        "done": ("Concluída", "#ecfdf5", "#065f46", "#a7f3d0"),
        "blocked": ("Bloqueada", "#fff1f2", "#9f1239", "#fecdd3"),
    }
    label, bg, fg, br = mapping.get(s, (f"Status: {s or '—'}", "#f4f6f8", "#334155", "#e5e7eb"))
    return _badge(label, bg=bg, fg=fg, border=br)


def _render_anexos(anexos: Optional[list[dict]]) -> str:
    if not anexos:
        return ""
    lis = []
    for a in anexos:
        name = _escape(a.get("name") or a.get("id") or "Anexo")
        url = a.get("url") or "#"
        size = a.get("size")
        size_txt = f" — {int(size/1024)} KB" if isinstance(size, (int, float)) and size > 0 else ""
        lis.append(
            f'''<li style="margin:4px 0;">
                  <a href="{_escape(url)}" style="color:#0ea5e9;text-decoration:none;">
                    {name}
                  </a><span style="color:#64748b;">{size_txt}</span>
                </li>'''
        )
    return f'''
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="font:14px/20px system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a;">
          <strong style="font-weight:600;">Anexos</strong>
          <ul style="margin:8px 0 0 18px; padding:0;">{''.join(lis)}</ul>
        </td>
      </tr>'''


def _render_tags(tags: Optional[list[str]]) -> str:
    if not tags:
        return ""
    chips = "".join(_chip(t) for t in tags[:12])
    return f'''
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td>{chips}</td>
      </tr>'''


def _render_attendees(emails: Optional[list[str]]) -> str:
    if not emails:
        return ""
    items = " · ".join(
        f'''<a href="mailto:{_escape(e)}" style="color:#0ea5e9;text-decoration:none;">{_escape(e)}</a>'''
        for e in emails[:20]
    )
    return f'''
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="font:14px/20px system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#334155;">
          <strong style="color:#0f172a;">Participantes:</strong> {items}
        </td>
      </tr>'''


def _responsavel_name(task: Task) -> Optional[str]:
    """
    Tenta extrair um 'responsável' de forma resiliente, cobrindo diferentes formas de modelagem:
    - task.assigned_to_user (dict com 'name')
    - task.user (obj/dict com 'name')
    - primeiro de assigned_users_info (lista de dicts)
    """
    cand = _safe_get(getattr(task, "assigned_to_user", None), "name")
    if cand:
        return cand
    cand = _safe_get(getattr(task, "user", None), "name")
    if cand:
        return cand
    try:
        lst = getattr(task, "assigned_users_info", None) or []
        if lst and isinstance(lst, list) and isinstance(lst[0], dict):
            return lst[0].get("name")
    except Exception:
        pass
    return None


# ------------------------------------------------------------
# Builder do corpo HTML do evento
# ------------------------------------------------------------

def build_event_body_html(
    *,
    task: Task,
    task_url: str,
    start_local: datetime,
    end_local: datetime,
    tz_name: str,
    attendees_emails: Optional[list[str]] = None
) -> str:
    """Gera HTML compatível com Outlook/Graph, com CSS inline e layout em table."""
    title = _escape(getattr(task, "title", "") or "")
    desc = _nl2br(getattr(task, "description", "") or "")
    categoria = _escape(getattr(task, "categoria", "") or "")
    prioridade = _priority_badge(getattr(task, "prioridade", None))
    status = _status_badge(getattr(task, "status", None))
    when_start = _format_dt_human(start_local, tz_name)
    when_end = _format_dt_human(end_local, tz_name)
    dur_min = int((end_local - start_local).total_seconds() // 60)

    # detalhes curtos (categoria, equipe, responsável)
    meta_linhas = []
    if categoria:
        meta_linhas.append(f"<strong>Categoria:</strong> {categoria}")

    team_name = getattr(task, "team_name", None)
    if team_name:
        meta_linhas.append(f"<strong>Equipe:</strong> {_escape(str(team_name))}")

    resp = _responsavel_name(task)
    if resp:
        meta_linhas.append(f"<strong>Responsável:</strong> {_escape(resp)}")

    meta_html = " · ".join(meta_linhas) if meta_linhas else ""

    # tags
    try:
        tags = list(getattr(task, "tags", None) or [])
    except Exception:
        tags = []

    # anexos
    try:
        anexos = list(getattr(task, "anexos", None) or [])
    except Exception:
        anexos = []

    return f"""
  <div style="width:100%;background:#f6f8fb;padding:16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="640"
           style="width:640px;max-width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:20px 20px 12px 20px;border-bottom:1px solid #e5e7eb;">
          <div style="font:700 18px/24px system-ui, -apple-system, Segoe UI, Roboto, Arial;color:#0f172a;">
            [ZG Planner] {title}
          </div>
          <div style="margin-top:8px;">{status} {prioridade}</div>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 20px 0 20px;font:14px/20px system-ui, -apple-system, Segoe UI, Roboto, Arial;color:#334155;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:top;width:56%;">
                <div style="color:#0f172a;font-weight:600;margin-bottom:4px;">Descrição</div>
                <div style="white-space:normal;">{desc or '<span style="color:#64748b;">(sem descrição)</span>'}</div>
              </td>
              <td style="width:4%;"></td>
              <td style="vertical-align:top;width:40%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                <div style="color:#0f172a;font-weight:600;margin-bottom:6px;">Quando</div>
                <div>Início: {when_start}</div>
                <div>Término: {when_end}</div>
                <div style="color:#64748b;margin-top:4px;">Duração estimada: {dur_min} min</div>

                <div style="height:10px;"></div>
                <div style="color:#0f172a;font-weight:600;margin-bottom:6px;">Detalhes</div>
                <div>{meta_html or '<span style="color:#64748b;">—</span>'}</div>
              </td>
            </tr>
          </table>

          { _render_tags(tags) }

          { _render_attendees(attendees_emails) }

          { _render_anexos(anexos) }

          <tr><td style="height:12px;"></td></tr>
          <tr>
            <td style="color:#94a3b8;font:12px/18px system-ui, -apple-system, Segoe UI, Roboto, Arial;">
              Este é um convite gerado automaticamente pelo ZG Planner.
            </td>
          </tr>
        </td>
      </tr>
    </table>
  </div>
  """.strip()


# ------------------------------------------------------------
# Função principal (criação de evento no calendário do criador)
# ------------------------------------------------------------

def schedule_task_event_for_creator(task_id: int, creator_user_id: int) -> dict | None:
    task = Task.query.get(task_id)
    if not task:
        current_app.logger.warning("[CAL] task_id=%s não encontrada", task_id)
        return None
    if not getattr(task, "due_date", None):
        current_app.logger.info("[CAL] task_id=%s sem due_date -> não cria evento", task_id)
        return None

    # Converte o due_date (naive=UTC) para horário local do calendário
    start_local = _as_local_from_utc(task.due_date, DEFAULT_TZ)

    mins = _minutes_from_task(task)
    end_local = start_local + timedelta(minutes=mins)
    if end_local <= start_local:
        end_local = start_local + timedelta(minutes=30)

    subject = f"[ZG Planner] {getattr(task, 'title', '')}"
    task_url = f"{FRONTEND_BASE_URL}/tasks/{getattr(task, 'id', task_id)}"

    # location curto (Outlook corta > 64 chars)
    location = (getattr(task, "categoria", None) or "")[:64]

    # Participantes: assigned + collaborators + quem atribuiu
    attendee_ids = set(getattr(task, "assigned_users", None) or [])
    attendee_ids.update(getattr(task, "collaborators", None) or [])
    if getattr(task, "assigned_by_user_id", None):
        attendee_ids.add(int(task.assigned_by_user_id))
    attendees_emails = _emails_by_ids(attendee_ids)

    # HTML estilizado
    body_html = build_event_body_html(
        task=task,
        task_url=task_url,
        start_local=start_local,
        end_local=end_local,
        tz_name=DEFAULT_TZ,
        attendees_emails=attendees_emails
    )

    current_app.logger.info(
        "[CAL] criando evento: task_id=%s creator_uid=%s original_due=%s start_local=%s tz=%s attendees=%s",
        getattr(task, "id", task_id), creator_user_id, getattr(task, "due_date", None), start_local, DEFAULT_TZ, attendees_emails
    )

    try:
        event = create_event_as_user(
            user_id=creator_user_id,
            subject=subject,
            start_iso=_iso_local(start_local),
            end_iso=_iso_local(end_local),
            timezone_str=DEFAULT_TZ,   # mantém timeZone explícito no Graph
            attendees=attendees_emails,
            body_html=body_html,
            location=location or ""
        )
        current_app.logger.info(
            "[CAL] evento criado com sucesso para task_id=%s (id=%s)",
            getattr(task, "id", task_id), (event or {}).get("id")
        )
        return event
    except Exception as e:
        current_app.logger.exception("[CAL] ERRO ao criar evento para task_id=%s: %s", getattr(task, "id", task_id), e)
        raise
