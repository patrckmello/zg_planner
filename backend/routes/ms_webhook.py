import os, json, logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
import requests
from flask_jwt_extended import jwt_required
from extensions import db
from models.task_model import Task
from models.user_integration_model import UserIntegration
from services.ms_graph_delegated import _headers, _ensure_token

ms_webhook = Blueprint("ms_webhook", __name__, url_prefix="/api/ms")
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
CLIENTSTATE = os.getenv("MS_SUBSCRIPTION_CLIENTSTATE", "zg-secret")

log = logging.getLogger("ms.webhook")

@ms_webhook.route("/notifications", methods=["GET","POST"])
def notifications():
    vt = request.args.get("validationToken")
    if vt:
        return vt, 200, {"Content-Type":"text/plain"}

    data = request.get_json(silent=True) or {}
    for n in data.get("value", []):
        if n.get("clientState") != CLIENTSTATE:
            log.warning("clientState inválido")
            continue

        res = n.get("resource") or ""
        ev_id = res.rsplit("/", 1)[-1]
        change = n.get("changeType")

        # tenta achar task pelo ms_event_id
        task = Task.query.filter_by(ms_event_id=ev_id).first()
        if not task:
            continue

        integ = UserIntegration.query.filter_by(user_id=task.user_id, provider="microsoft").first()
        if not integ:
            continue

        try:
            token = _ensure_token(integ)
            if change == "deleted":
                task.ms_event_id   = None
                task.ms_event_etag = None
                task.ms_sync_status = "deleted"
                task.ms_last_sync  = datetime.now(timezone.utc)
                db.session.commit()
                continue

            # GET /me/events/{id}
            url = f"{GRAPH_BASE}/me/events/{ev_id}"
            resp = requests.get(url, headers=_headers(token), timeout=15)
            if resp.status_code != 200:
                log.error("GET event %s -> %s %s", ev_id, resp.status_code, resp.text[:200])
                continue
            ev = resp.json()

            # aplica no mínimo: título, body, start/end -> due_date
            task.title = ev.get("subject") or task.title
            body = (ev.get("body") or {}).get("content") or None
            if body: task.description = body

            start = (ev.get("start") or {}).get("dateTime")
            if start:
                # como na ida tu usa LOCAL -> considera voltar para UTC naive
                try:
                    # start vem local sem offset — trata como LOCAL_TIMEZONE e converte pra UTC
                    from zoneinfo import ZoneInfo
                    tz = ZoneInfo(os.getenv("DEFAULT_TZ","America/Sao_Paulo"))
                    dt_local = datetime.fromisoformat(start)
                    dt_utc = dt_local.replace(tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
                    task.due_date = dt_utc
                except Exception:
                    pass

            task.ms_event_etag  = ev.get("@odata.etag") or ev.get("etag") or task.ms_event_etag
            task.ms_last_sync   = datetime.now(timezone.utc)
            task.ms_sync_status = "ok"
            db.session.commit()

        except Exception as e:
            log.exception("Erro notificacao Graph: %s", e)

    return jsonify({"ok": True})

@ms_webhook.route("/subscriptions", methods=["POST"])
@jwt_required()
def create_subscription():
    from flask_jwt_extended import get_jwt_identity
    uid = get_jwt_identity()
    integ = UserIntegration.query.filter_by(user_id=uid, provider="microsoft").first()
    if not integ:
        return jsonify({"error":"Conecte o Microsoft primeiro."}), 400

    token = _ensure_token(integ)
    payload = {
        "changeType": "created,updated,deleted",
        "notificationUrl": os.getenv("MS_NOTIFICATION_URL"),  # https URL público
        "resource": "/me/events",
        "expirationDateTime": (datetime.utcnow() + timedelta(hours=24)).replace(microsecond=0).isoformat()+"Z",
        "clientState": CLIENTSTATE
    }
    resp = requests.post(f"{GRAPH_BASE}/subscriptions", headers=_headers(token), data=json.dumps(payload), timeout=15)
    if resp.status_code not in (200,201):
        return jsonify({"error": resp.text}), 400
    return resp.json(), 201
