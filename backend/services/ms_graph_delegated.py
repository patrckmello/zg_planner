import os, json, logging, requests
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import msal
from zoneinfo import ZoneInfo

from extensions import db
from models.user_integration_model import UserIntegration

# ========= Config =========
LOCAL_TZ = os.getenv("LOCAL_TIMEZONE", "America/Sao_Paulo")  # sua TZ "de parede"/IANA
GRAPH_BASE = "https://graph.microsoft.com/v1.0"

TENANT = os.getenv("GRAPH_TENANT_ID")
CLIENT_ID = os.getenv("GRAPH_CLIENT_ID")
CLIENT_SECRET = os.getenv("GRAPH_CLIENT_SECRET")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT}"

# Scopes de RECURSO (sem OIDC)
SCOPES_RAW = (os.getenv("GRAPH_SCOPES") or "Mail.Send Calendars.ReadWrite").split()
RESERVED_OIDC = {"openid", "profile", "offline_access"}
SCOPES = [s for s in SCOPES_RAW if s not in RESERVED_OIDC] or ["Mail.Send", "Calendars.ReadWrite"]

log = logging.getLogger("graph.delegated")

# ========= Helpers de TZ =========
# Mapeia IANA -> Windows TZ (o Graph lida melhor com estes nomes)
# Fonte básica: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/default-time-zones
IANA_TO_WINDOWS_TZ = {
    "America/Sao_Paulo": "E. South America Standard Time",
    "America/Sao_Paulo/": "E. South America Standard Time",  # segurança
    # adicione outros se precisar
}

def _to_graph_tz(tz_name: str) -> str:
    """Converte IANA ('America/Sao_Paulo') para Windows ('E. South America Standard Time')."""
    if not tz_name:
        tz_name = LOCAL_TZ
    return IANA_TO_WINDOWS_TZ.get(tz_name, IANA_TO_WINDOWS_TZ.get(LOCAL_TZ, "E. South America Standard Time"))

def _sanitize_for_graph(dt_iso: str, tz_name: str) -> tuple[str, str]:
    """
    Normaliza para o formato que o Graph espera:
    - Se dt_iso vier AWARE (com 'Z' ou offset), converte para 'hora de parede' do tz_name e remove o offset.
    - Se vier NAIVE (sem offset), apenas formata 'YYYY-MM-DDTHH:MM:SS'.
    Retorna (local_date_time_str, windows_tz_name)
    """
    iana_tz = tz_name or LOCAL_TZ
    windows_tz = _to_graph_tz(iana_tz)

    try:
        raw = (dt_iso or "").strip()
        if not raw:
            return dt_iso, windows_tz
        raw = raw.replace("Z", "+00:00")  # permite parse de 'Z'
        dt = datetime.fromisoformat(raw)
    except Exception:
        # Se não der parse, devolve como veio
        return dt_iso, windows_tz

    if dt.tzinfo is None:
        # Já é 'hora de parede' — só padroniza
        return dt.strftime("%Y-%m-%dT%H:%M:%S"), windows_tz

    # Tinha offset/Z -> converte para o fuso alvo e remove o offset
    try:
        tz = ZoneInfo(iana_tz)
    except Exception:
        tz = ZoneInfo(LOCAL_TZ)
    local_dt = dt.astimezone(tz).replace(tzinfo=None)
    return local_dt.strftime("%Y-%m-%dT%H:%M:%S"), windows_tz

# ========= MSAL / Token =========
def _app() -> msal.ConfidentialClientApplication:
    return msal.ConfidentialClientApplication(
        CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET
    )

def _utcnow_naive() -> datetime:
    return datetime.utcnow()

def _to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def _ensure_token(integ: UserIntegration) -> str:
    now = _utcnow_naive()
    exp = _to_naive_utc(integ.expires_at)

    if integ.access_token and exp and (exp > now + timedelta(seconds=60)):
        return integ.access_token

    if not integ.refresh_token:
        raise RuntimeError("A conexão Microsoft expirou. Reconecte sua conta.")

    app = _app()
    result = app.acquire_token_by_refresh_token(integ.refresh_token, SCOPES)
    if "access_token" not in result:
        raise RuntimeError(f"Falha ao renovar token: {result}")

    integ.access_token = result["access_token"]
    if result.get("refresh_token"):  # refresh rotation
        integ.refresh_token = result["refresh_token"]
    integ.expires_at = now + timedelta(seconds=int(result.get("expires_in", 3600)))
    db.session.add(integ)
    db.session.commit()
    return integ.access_token

def _headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ========= E-mail em nome do usuário =========
def send_mail_as_user(user_id: int, to: List[str], subject: str,
                      html_body: Optional[str] = None, text_body: Optional[str] = None,
                      cc: Optional[List[str]] = None, bcc: Optional[List[str]] = None) -> None:
    integ = UserIntegration.query.filter_by(user_id=user_id, provider="microsoft").first()
    if not integ:
        raise RuntimeError("Usuário não conectado ao Microsoft.")
    token = _ensure_token(integ)

    body_content_type = "HTML" if html_body else "Text"
    body_content = html_body or (text_body or "(sem conteúdo)")
    message = {
        "subject": subject,
        "body": {"contentType": body_content_type, "content": body_content},
        "toRecipients": [{"emailAddress": {"address": e}} for e in to],
    }
    if cc:
        message["ccRecipients"] = [{"emailAddress": {"address": e}} for e in cc]
    if bcc:
        message["bccRecipients"] = [{"emailAddress": {"address": e}} for e in bcc]

    payload = {"message": message, "saveToSentItems": True}
    url = f"{GRAPH_BASE}/me/sendMail"
    resp = requests.post(url, headers=_headers(token), data=json.dumps(payload), timeout=20)
    if resp.status_code not in (202, 200, 204):
        log.error("Erro sendMail delegado: %s | %s", resp.status_code, resp.text)
        raise RuntimeError(resp.text)

# ========= Evento no calendário do usuário =========
def create_event_as_user(user_id: int, subject: str, start_iso: str, end_iso: str,
                         timezone_str: str = LOCAL_TZ, attendees: Optional[List[str]] = None,
                         body_html: Optional[str] = None, location: Optional[str] = None) -> Dict:
    """
    start_iso / end_iso podem vir com 'Z' ou offset. Vamos sempre convertê-los
    para 'hora de parede' do fuso solicitado e enviar com timeZone = Windows TZ.
    """
    integ = UserIntegration.query.filter_by(user_id=user_id, provider="microsoft").first()
    if not integ:
        raise RuntimeError("Usuário não conectado ao Microsoft.")
    token = _ensure_token(integ)

    # ✅ NORMALIZAÇÃO CRÍTICA (IANA -> hora local + Windows TZ)
    start_local, tz_graph = _sanitize_for_graph(start_iso, timezone_str or LOCAL_TZ)
    end_local, _ = _sanitize_for_graph(end_iso, timezone_str or LOCAL_TZ)

    url = f"{GRAPH_BASE}/me/events"
    body = {
        "subject": subject,
        "start": {"dateTime": start_local, "timeZone": tz_graph},
        "end":   {"dateTime": end_local,   "timeZone": tz_graph},
        "body": {"contentType": "HTML", "content": body_html or ""},
        "location": {"displayName": location or ""},
        "attendees": [{"emailAddress": {"address": e}, "type": "required"} for e in (attendees or [])],
        "allowNewTimeProposals": True,
    }

    # Log útil (sem token)
    try:
        log.info("[GRAPH] POST /me/events payload=%s", json.dumps(body, ensure_ascii=False))
    except Exception:
        pass

    resp = requests.post(url, headers=_headers(token), data=json.dumps(body), timeout=20)
    if resp.status_code not in (200, 201):
        log.error("Erro criar evento delegado: %s | %s", resp.status_code, resp.text)
        raise RuntimeError(resp.text)
    return resp.json()
