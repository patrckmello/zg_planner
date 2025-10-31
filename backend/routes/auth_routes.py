from flask import Blueprint, request, jsonify, session, make_response
from models.user_model import User
from extensions import db
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, get_jwt
from models.audit_log_model import AuditLog
from urllib.parse import urlencode
from datetime import datetime
from models.password_reset_model import PasswordResetToken
from models.notification_outbox_model import NotificationOutbox
import os

auth_bp = Blueprint('auth', __name__, url_prefix='/api')

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://10.1.243.120:5174")

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        # Log de tentativa de login falha
        AuditLog.log_action(
            user_id=None,  # Não há user_id válido ainda
            action='LOGIN_FAILED',
            description=f'Tentativa de login falha para o email: {email}',
            resource_type='auth',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        return jsonify({'error': 'Credenciais inválidas'}), 401

    if not user.is_active:
        # Log de tentativa de login de usuário inativo
        AuditLog.log_action(
            user_id=user.id,
            action='LOGIN_FAILED',
            description=f'Tentativa de login de usuário inativo: {user.username}',
            resource_type='auth',
            resource_id=user.id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        return jsonify({'error': 'Usuário inativo. Contate o administrador.'}), 403

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"must_change_password": bool(user.must_change_password)}
    )
    refresh_token = create_refresh_token(identity=str(user.id))
    
    # Log de login bem-sucedido
    AuditLog.log_action(
        user_id=user.id,
        action='LOGIN_SUCCESS',
        description=f'Login bem-sucedido para o usuário: {user.username}',
        resource_type='auth',
        resource_id=user.id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

    return jsonify({
        'message': 'Login realizado com sucesso!',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
        'forcePasswordChange': bool(user.must_change_password)
    })

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    from models.jwt_blocklist import JWTBlocklist
    old_jti = get_jwt().get("jti")
    if old_jti:
        db.session.add(JWTBlocklist(jti=old_jti))  # revoga refresh usado
    uid = get_jwt_identity()
    new_access = create_access_token(identity=uid, fresh=False)
    new_refresh = create_refresh_token(identity=uid)
    db.session.commit()
    return jsonify({'access_token': new_access, 'refresh_token': new_refresh}), 200

@auth_bp.route('/logout', methods=['POST'])
@jwt_required(optional=True)
def logout():
    from models.jwt_blocklist import JWTBlocklist
    user_id = None
    try:
        jti = get_jwt().get("jti")
        user_id = get_jwt_identity()  # ✅ captura o ID do usuário logado
        if jti:
            db.session.add(JWTBlocklist(jti=jti))
            db.session.commit()
    except Exception:
        pass

    session.clear()
    response = make_response(jsonify({'message': 'Logout bem-sucedido!'}), 200)
    response.set_cookie('session', '', expires=0)

    # Log de logout
    if user_id:
        AuditLog.log_action(
            user_id=user_id,
            action='LOGOUT',
            description='Usuário realizou logout',
            resource_type='auth',
            resource_id=user_id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
    return response

@auth_bp.route('/password/forgot', methods=['POST'])
def password_forgot():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or "").strip().lower()

    try:
        user = User.query.filter_by(email=email).first()

        if user and getattr(user, "is_active", True):
            # 1) gera token
            tok = PasswordResetToken.generate(user_id=user.id, ttl_minutes=60)
            db.session.flush()

            # 2) monta URL absoluta para o frontend
            reset_url = f"{FRONTEND_BASE_URL}/reset-password?{urlencode({'token': tok.token})}"

            # 3) enfileira e-mail (Outbox)
            html = f"""
                <!doctype html><html><body style="margin:0;padding:16px;font-family:Arial,sans-serif;color:#111827;">
                <h2 style="margin:0 0 12px 0;">Redefinição de senha</h2>
                <p style="margin:0 0 10px 0;">Clique no link abaixo para criar uma nova senha. O link expira em 60 minutos.</p>
                <p style="margin:0 0 16px 0;">
                    <a href="{reset_url}" target="_blank">{reset_url}</a>
                </p>
                <p style="font-size:12px;color:#6b7280;margin:0;">Se você não solicitou esta ação, ignore este e-mail.</p>
                </body></html>
                """.strip()

            NotificationOutbox.enqueue_email(
                kind="password_reset",
                recipients=[{"email": user.email, "name": getattr(user, 'first_name', None) or user.username}],
                subject="[ZG Planner] Redefinição de senha",
                body="",
                is_html=True,
                user_id=user.id,
                task_id=None,
                extra_payload={"reset_url": reset_url}
            )

            # 4) auditoria
            AuditLog.log_action(
                user_id=user.id,
                action='PASSWORD_RESET_REQUESTED',
                description=f'Reset de senha solicitado para {user.email}',
                resource_type='auth',
                resource_id=user.id,
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent')
            )

            db.session.commit()

    except Exception:
        db.session.rollback()

    return jsonify({"message": "Se o e-mail existir e estiver ativo, enviaremos instruções de redefinição."}), 200


@auth_bp.route('/password/validate', methods=['GET'])
def password_validate():
    token_str = request.args.get('token', '').strip()
    tok = PasswordResetToken.query.filter_by(token=token_str).first()
    if not tok or not tok.is_valid():
        return jsonify({"valid": False, "error": "Token inválido ou expirado"}), 400
    return jsonify({"valid": True}), 200


@auth_bp.route('/password/reset', methods=['POST'])
def password_reset():
    data = request.get_json(silent=True) or {}
    token_str = (data.get('token') or "").strip()
    new_password = data.get('new_password') or ""

    # valida token
    tok = PasswordResetToken.query.filter_by(token=token_str).first()
    if not tok or not tok.is_valid():
        return jsonify({"error": "Token inválido ou expirado"}), 400

    user = User.query.get(tok.user_id)
    if not user or not user.is_active:
        return jsonify({"error": "Usuário inválido"}), 400

    # regras básicas de senha
    if len(new_password) < 6:
        return jsonify({"error": "Senha deve ter pelo menos 6 caracteres"}), 400

    # troca senha e invalida token
    user.set_password(new_password)
    tok.used_at = datetime.utcnow()

    # Audit
    AuditLog.log_action(
        user_id=user.id,
        action='PASSWORD_RESET_SUCCESS',
        description='Senha redefinida com sucesso via link de redefinição',
        resource_type='auth',
        resource_id=user.id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    db.session.commit()

    return jsonify({"message": "Senha alterada com sucesso. Faça login com a nova senha."}), 200
