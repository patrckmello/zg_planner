from flask import Blueprint, request, jsonify, session, make_response
from models.user_model import User
from extensions import db
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from models.audit_log_model import AuditLog

auth_bp = Blueprint('auth', __name__, url_prefix='/api')

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

    access_token = create_access_token(identity=str(user.id))
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
        'user': user.to_dict()
    })

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user_id)
    return jsonify({'access_token': new_access_token})

@auth_bp.route('/logout', methods=['POST'])
def logout():
    user_id = None
    try:
        # Tenta obter o ID do usuário logado, se houver
        current_user_id = get_jwt_identity()
        if current_user_id:
            user_id = int(current_user_id)
    except Exception:
        pass # Ignora se não houver token ou for inválido

    session.clear()
    response = make_response(jsonify({'message': 'Logout bem-sucedido!'}), 200)
    response.set_cookie('session', '', expires=0)

    # Log de logout
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


