import os, json, logging, requests
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import msal

from extensions import db
from models.user_integration_model import UserIntegration

log = logging.getLogger("graph.delegated")
GRAPH_BASE = "https://graph.microsoft.com/v1.0"

TENANT = os.getenv("GRAPH_TENANT_ID")
CLIENT_ID = os.getenv("GRAPH_CLIENT_ID")
CLIENT_SECRET = os.getenv("GRAPH_CLIENT_SECRET")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT}"

# Use apenas SCOPES de RECURSO aqui também
SCOPES_RAW = (os.getenv("GRAPH_SCOPES") or "Mail.Send Calendars.ReadWrite").split()
RESERVED_OIDC = {"openid", "profile", "offline_access"}
SCOPES = [s for s in SCOPES_RAW if s not in RESERVED_OIDC]
if not SCOPES:
    SCOPES = ["Mail.Send", "Calendars.ReadWrite"]

def _app() -> msal.ConfidentialClientApplication:
    return msal.ConfidentialClientApplication(
        CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET
    )

def _utcnow_naive() -> datetime:
    # sempre UTC sem tzinfo
    return datetime.utcnow()

def _to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    # se vier aware, converte p/ UTC e remove tzinfo
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def _ensure_token(integ: UserIntegration) -> str:
    now = _utcnow_naive()
    exp = _to_naive_utc(integ.expires_at)

    # usa token se ainda não expirou (folga de 60s)
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
    db.session.add(integ); db.session.commit()
    return integ.access_token

def _headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
# --------- E-mail em nome do usuário ---------
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

# --------- Evento no calendário do usuário ---------
def create_event_as_user(user_id: int, subject: str, start_iso: str, end_iso: str,
                         timezone_str: str = "America/Sao_Paulo", attendees: Optional[List[str]] = None,
                         body_html: Optional[str] = None, location: Optional[str] = None) -> Dict:
    integ = UserIntegration.query.filter_by(user_id=user_id, provider="microsoft").first()
    if not integ:
        raise RuntimeError("Usuário não conectado ao Microsoft.")
    token = _ensure_token(integ)

    url = f"{GRAPH_BASE}/me/events"
    body = {
        "subject": subject,
        "start": {"dateTime": start_iso, "timeZone": timezone_str},
        "end":   {"dateTime": end_iso,   "timeZone": timezone_str},
        "body": {"contentType": "HTML", "content": body_html or ""},
        "location": {"displayName": location or ""},
        "attendees": [{"emailAddress": {"address": e}, "type": "required"} for e in (attendees or [])],
        "allowNewTimeProposals": True,
    }
    resp = requests.post(url, headers=_headers(token), data=json.dumps(body), timeout=20)
    if resp.status_code not in (200, 201):
        log.error("Erro criar evento delegado: %s | %s", resp.status_code, resp.text)
        raise RuntimeError(resp.text)
    return resp.json()
