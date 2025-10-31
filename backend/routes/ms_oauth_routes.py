import os, re, logging
from urllib.parse import urlencode, quote
from datetime import datetime, timedelta, timezone
from flask import Blueprint, redirect, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import msal

from extensions import db
from models.user_integration_model import UserIntegration

bp = Blueprint("ms_oauth", __name__, url_prefix="/api/ms")
log = logging.getLogger("ms.oauth")

TENANT = os.getenv("GRAPH_TENANT_ID")
CLIENT_ID = os.getenv("GRAPH_CLIENT_ID")
CLIENT_SECRET = os.getenv("GRAPH_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GRAPH_REDIRECT_URI")
FRONTEND_OK = os.getenv("FRONTEND_AFTER_CONNECT", "/")
FRONTEND_ERR = os.getenv("FRONTEND_AFTER_ERROR", "/")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")

AUTHORITY = f"https://login.microsoftonline.com/{TENANT}"
AUTH_URL = f"{AUTHORITY}/oauth2/v2.0/authorize"  # usaremos URL manual

# -------- helpers --------
def _parse_scopes(raw: str) -> list[str]:
    if not raw:
        return []
    import re as _re
    parts = _re.split(r"[,\s;]+", raw.strip())
    return [p for p in parts if p]

# Scopes do Graph vindos do .env (somente RECURSO)
GRAPH_SCOPES = _parse_scopes(os.getenv("GRAPH_SCOPES") or "User.Read Mail.Send Calendars.ReadWrite")

# Scopes OIDC reservados (para gerar ID token e refresh token)
OIDC_SCOPES = ["openid", "profile", "offline_access"]

# Scopes que iremos mandar na URL de autorização (OIDC + Graph)
AUTH_SCOPES = OIDC_SCOPES + GRAPH_SCOPES

def _msal_app():
    return msal.ConfidentialClientApplication(
        CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET
    )

def _state_sign(user_id: int) -> str:
    s = URLSafeTimedSerializer(SECRET_KEY, salt="ms_oauth_state")
    return s.dumps({"uid": user_id})

def _state_verify(token: str, max_age=600) -> int:
    s = URLSafeTimedSerializer(SECRET_KEY, salt="ms_oauth_state")
    data = s.loads(token, max_age=max_age)  # 10 min
    return int(data["uid"])

# -------- routes --------
@bp.route("/status", methods=["GET"])
@jwt_required()
def status():
    uid = get_jwt_identity()
    integ = UserIntegration.query.filter_by(user_id=uid, provider="microsoft").first()
    if not integ:
        return jsonify({
            "connected": False,
            "requested_scopes": " ".join(AUTH_SCOPES),
            "graph_scopes": " ".join(GRAPH_SCOPES),
        })
    exp = integ.expires_at.isoformat() if integ.expires_at else None
    return jsonify({
        "connected": True,
        "email": integ.email,
        "name": integ.display_name,
        "expires_at": exp,
        "requested_scopes": " ".join(AUTH_SCOPES),
        "graph_scopes": " ".join(GRAPH_SCOPES),
    })

@bp.route("/connect", methods=["GET"])
@jwt_required()
def connect():
    uid = get_jwt_identity()
    state = _state_sign(uid)

    # Monta a URL manualmente, garantindo encoding com %20 (e não '+')
    scopes_str = " ".join(AUTH_SCOPES)
    query = urlencode({
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "response_mode": "query",
        "scope": scopes_str,
        "state": state,
        "prompt": "select_account",
    }, quote_via=quote)

    final_url = f"{AUTH_URL}?{query}"
    log.info("[MS-OAUTH] Redirect authorize URL = %s", final_url)
    return redirect(final_url, code=302)

@bp.route("/connect_url", methods=["GET"])
@jwt_required()
def connect_url():
    """
    Retorna em JSON a URL de autorização do Microsoft Identity,
    para o frontend redirecionar o browser (window.location).
    """
    uid = get_jwt_identity()
    state = _state_sign(uid)
    app = _msal_app()
    auth_url = app.get_authorization_request_url(
        scopes=GRAPH_SCOPES,
        redirect_uri=REDIRECT_URI,
        state=state,
        prompt="select_account",
        response_mode="query",
    )
    current_app.logger.info("[MS-OAUTH] connect_url -> %s", auth_url)
    return jsonify({"url": auth_url})


@bp.route("/callback", methods=["GET"])
def callback():
    error = request.args.get("error")
    if error:
        current_app.logger.error("[MS-OAUTH] Erro na autorização: %s", error)
        status = "err"
        email = ""
    else:
        code = request.args.get("code")
        state = request.args.get("state")
        if not code or not state:
            current_app.logger.error("[MS-OAUTH] Callback sem code/state")
            status = "err"
            email = ""
        else:
            try:
                uid = _state_verify(state)
            except (BadSignature, SignatureExpired):
                current_app.logger.error("[MS-OAUTH] State inválido/expirado")
                status = "err"
                email = ""
            else:
                app = _msal_app()
                current_app.logger.info("[MS-OAUTH] Troca code->token (scopes=%s)", GRAPH_SCOPES)
                result = app.acquire_token_by_authorization_code(
                    code, scopes=GRAPH_SCOPES, redirect_uri=REDIRECT_URI
                )
                if "access_token" not in result:
                    current_app.logger.error("[MS-OAUTH] Falha token: %s", result)
                    status = "err"
                    email = ""
                else:
                    idt = result.get("id_token_claims") or {}
                    oid = idt.get("oid")
                    upn = idt.get("preferred_username") or idt.get("email") or idt.get("unique_name")
                    name = idt.get("name")
                    expires_in = int(result.get("expires_in", 3600))
                    # >>> use sempre UTC awareness
                    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

                    integ = UserIntegration.query.filter_by(user_id=uid, provider="microsoft").first()
                    if not integ:
                        integ = UserIntegration(user_id=uid, provider="microsoft")
                        db.session.add(integ)

                    integ.provider_user_id = oid
                    integ.email = upn
                    integ.display_name = name
                    integ.access_token = result["access_token"]
                    if result.get("refresh_token"):
                        integ.refresh_token = result["refresh_token"]
                    integ.expires_at = expires_at
                    integ.scopes = " ".join(GRAPH_SCOPES)
                    db.session.commit()

                    current_app.logger.info("[MS-OAUTH] Conectado: %s (%s)", name, upn)
                    status = "ok"
                    email = upn or ""

    # Resposta para popup: envia postMessage ao opener e fecha
    html = f"""
    <!doctype html><meta charset="utf-8">
    <style>body{{font-family:system-ui;margin:24px;color:#111}}.box{{padding:16px;border:1px solid #ddd;border-radius:8px}}</style>
    <div class="box">
      <b>Você pode fechar esta janela.</b><br/>
      Status: <code>{status}</code>{' — '+email if email else ''}
    </div>
    <script>
      (function(){{
        try {{
          if (window.opener) {{
            window.opener.postMessage({{
              source: "zg_planner",
              provider: "microsoft",
              status: "{status}",
              email: "{email}"
            }}, "*");
          }}
        }} catch(e) {{}}
        setTimeout(function(){{ window.close(); }}, 300);
      }})();
    </script>
    """
    return html, 200, {"Content-Type": "text/html; charset=utf-8"}

@bp.route("/disconnect", methods=["POST"])
@jwt_required()
def disconnect():
    uid = get_jwt_identity()
    integ = UserIntegration.query.filter_by(user_id=uid, provider="microsoft").first()
    if not integ:
        return jsonify({"ok": True})
    db.session.delete(integ)
    db.session.commit()
    log.info("[MS-OAUTH] Usuário %s desconectou Microsoft", uid)
    return jsonify({"ok": True})
