from flask import request, g
from models.audit_log_model import AuditLog
from flask_jwt_extended import get_jwt_identity, jwt_required
from functools import wraps

def audit_middleware(app):
    """Middleware para logging automático de auditoria"""
    
    @app.before_request
    def before_request():
        # Armazenar informações da requisição para uso posterior
        g.start_time = time.time()
        g.ip_address = request.remote_addr
        g.user_agent = request.headers.get('User-Agent')
    
    @app.after_request
    def after_request(response):
        # Aqui você pode adicionar lógica para logging automático
        # se necessário para certas rotas
        return response

def audit_action(action, description, resource_type=None, resource_id=None):
    """Decorator para auditoria automática de ações"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Executar função original
                result = f(*args, **kwargs)
                
                # Se a função foi executada com sucesso, fazer log
                try:
                    user_id = get_jwt_identity()
                    AuditLog.log_action(
                        user_id=user_id,
                        action=action,
                        description=description,
                        resource_type=resource_type,
                        resource_id=resource_id,
                        ip_address=request.remote_addr,
                        user_agent=request.headers.get('User-Agent')
                    )
                except:
                    # Se falhar o log, não quebrar a aplicação
                    pass
                
                return result
            except Exception as e:
                # Se a função falhar, também fazer log do erro
                try:
                    user_id = get_jwt_identity()
                    AuditLog.log_action(
                        user_id=user_id,
                        action='ERROR',
                        description=f'Erro ao {description.lower()}: {str(e)}',
                        resource_type=resource_type,
                        resource_id=resource_id,
                        ip_address=request.remote_addr,
                        user_agent=request.headers.get('User-Agent')
                    )
                except:
                    pass
                raise e
        
        return decorated_function
    return decorator

import time

