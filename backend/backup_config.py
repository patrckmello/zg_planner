"""
Configurações para o sistema de backup do ZG Planner
"""

import os
from datetime import timedelta

class BackupConfig:
    """Configurações do sistema de backup"""
    
    # Diretório base para backups
    BACKUP_BASE_DIR = os.path.join(os.getcwd(), 'backups')
    
    # Tipos de backup suportados
    BACKUP_TYPES = ['full', 'schema_only', 'data_only']
    
    # Configurações de retenção
    RETENTION_POLICY = {
        'daily_backups': 7,      # Manter backups diários por 7 dias
        'weekly_backups': 4,     # Manter backups semanais por 4 semanas
        'monthly_backups': 12,   # Manter backups mensais por 12 meses
    }
    
    # Configurações de compressão
    COMPRESSION = {
        'enabled': True,
        'level': 6,  # Nível de compressão ZIP (0-9)
    }
    
    # Configurações de timeout
    TIMEOUTS = {
        'backup_creation': 300,  # 5 minutos
        'database_query': 60,    # 1 minuto
    }
    
    # Configurações de notificação
    NOTIFICATIONS = {
        'email_on_success': False,
        'email_on_failure': True,
        'webhook_url': None,
    }
    
    # Configurações de segurança
    SECURITY = {
        'encrypt_backups': False,
        'encryption_key': None,
        'max_backup_size': 1024 * 1024 * 1024,  # 1GB
    }
    
    # Configurações específicas do banco
    DATABASE = {
        'connection_timeout': 30,
        'query_timeout': 60,
        'max_connections': 5,
    }
    
    # Configurações de logging
    LOGGING = {
        'level': 'INFO',
        'file': os.path.join(BACKUP_BASE_DIR, 'backup.log'),
        'max_size': 10 * 1024 * 1024,  # 10MB
        'backup_count': 5,
    }
    
    @classmethod
    def get_backup_dir(cls, backup_type='full'):
        """Retorna diretório específico para tipo de backup"""
        type_dir = os.path.join(cls.BACKUP_BASE_DIR, backup_type)
        os.makedirs(type_dir, exist_ok=True)
        return type_dir
    
    @classmethod
    def get_retention_days(cls, backup_type='daily'):
        """Retorna número de dias para retenção"""
        return cls.RETENTION_POLICY.get(f'{backup_type}_backups', 7)
    
    @classmethod
    def is_valid_backup_type(cls, backup_type):
        """Verifica se o tipo de backup é válido"""
        return backup_type in cls.BACKUP_TYPES
    
    @classmethod
    def get_max_backup_size(cls):
        """Retorna tamanho máximo permitido para backup"""
        return cls.SECURITY['max_backup_size']
    
    @classmethod
    def should_encrypt(cls):
        """Verifica se deve criptografar backups"""
        return cls.SECURITY['encrypt_backups'] and cls.SECURITY['encryption_key']

# Configurações específicas por ambiente
class DevelopmentBackupConfig(BackupConfig):
    """Configurações para ambiente de desenvolvimento"""
    
    RETENTION_POLICY = {
        'daily_backups': 3,
        'weekly_backups': 2,
        'monthly_backups': 1,
    }
    
    NOTIFICATIONS = {
        'email_on_success': False,
        'email_on_failure': False,
        'webhook_url': None,
    }

class ProductionBackupConfig(BackupConfig):
    """Configurações para ambiente de produção"""
    
    RETENTION_POLICY = {
        'daily_backups': 30,     # 30 dias
        'weekly_backups': 12,    # 12 semanas
        'monthly_backups': 24,   # 24 meses
    }
    
    NOTIFICATIONS = {
        'email_on_success': True,
        'email_on_failure': True,
        'webhook_url': os.getenv('BACKUP_WEBHOOK_URL'),
    }
    
    SECURITY = {
        'encrypt_backups': True,
        'encryption_key': os.getenv('BACKUP_ENCRYPTION_KEY'),
        'max_backup_size': 5 * 1024 * 1024 * 1024,  # 5GB
    }

# Função para obter configuração baseada no ambiente
def get_backup_config():
    """Retorna configuração baseada na variável de ambiente"""
    env = os.getenv('FLASK_ENV', 'development')
    
    if env == 'production':
        return ProductionBackupConfig
    else:
        return DevelopmentBackupConfig

# Configuração ativa
ACTIVE_CONFIG = get_backup_config()

