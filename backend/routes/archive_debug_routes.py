from flask import Blueprint, jsonify, current_app, request
from flask_jwt_extended import jwt_required
from archive_scheduler import archive_done_tasks_once

archive_debug_bp = Blueprint("archive_debug", __name__, url_prefix="/api/_debug/archive")

@archive_debug_bp.route("/run", methods=["POST"])
@jwt_required(optional=True)  # em dev pode deixar sem auth
def run_archive_once():
    days = request.args.get("days", default=7, type=int)
    count = archive_done_tasks_once(current_app._get_current_object(), days=days)
    return jsonify({"ok": True, "archived": count, "days": days})
