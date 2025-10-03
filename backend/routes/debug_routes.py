from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from jobs.outbox_worker import process_outbox_batch

debug_bp = Blueprint("debug", __name__, url_prefix="/api/_debug")

@debug_bp.route("/outbox/run", methods=["POST"])
@jwt_required(optional=True)
def run_outbox_once():
    process_outbox_batch()
    return jsonify({"ok": True})
