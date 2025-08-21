#!/usr/bin/env python3
"""
Script CLI para gerenciamento de backups do ZG Planner
Uso: python backup_cli.py [comando] [opções]
"""

import sys
import os
import argparse
import datetime
from app import app
from backup_service import BackupService
from models.user_model import User

def create_backup(args):
    """Cria um novo backup"""
    backup_service = BackupService(app)
    
    # Para CLI, usar usuário admin ou criar um usuário sistema
    with app.app_context():
        admin_user = User.query.filter_by(is_admin=True).first()
        if not admin_user:
            print("❌ Erro: Nenhum usuário administrador encontrado")
            return False
        
        user_id = admin_user.id
    
    print(f"🔄 Iniciando backup do tipo '{args.type}'...")
    
    result = backup_service.create_full_backup(user_id, args.type)
    
    if result['success']:
        backup_info = result['backup']
        print(f"✅ Backup criado com sucesso!")
        print(f"📁 Arquivo: {backup_info['filename']}")
        print(f"📊 Tamanho: {backup_info['file_size']} bytes")
        print(f"📍 Localização: {backup_info['file_path']}")
        return True
    else:
        print(f"❌ Erro ao criar backup: {result['error']}")
        return False

def list_backups(args):
    """Lista todos os backups"""
    backup_service = BackupService(app)
    
    backups = backup_service.list_backups()
    
    if not backups:
        print("📋 Nenhum backup encontrado")
        return True
    
    print(f"📋 Backups disponíveis ({len(backups)}):")
    print("-" * 80)
    
    for backup in backups:
        status_icon = "✅" if backup['status'] == 'completed' else "❌" if backup['status'] == 'error' else "🔄"
        size_mb = round(backup['file_size'] / 1024 / 1024, 2) if backup['file_size'] else 0
        
        print(f"{status_icon} ID: {backup['id']}")
        print(f"   📁 Arquivo: {backup['filename']}")
        print(f"   📊 Tamanho: {size_mb} MB")
        print(f"   📅 Criado: {backup['created_at']}")
        print(f"   👤 Por: {backup['user_name']}")
        
        if backup['status'] == 'error' and backup['error_message']:
            print(f"   ⚠️  Erro: {backup['error_message']}")
        
        print()
    
    return True

def delete_backup(args):
    """Exclui um backup específico"""
    backup_service = BackupService(app)
    
    # Obter usuário admin
    with app.app_context():
        admin_user = User.query.filter_by(is_admin=True).first()
        if not admin_user:
            print("❌ Erro: Nenhum usuário administrador encontrado")
            return False
        
        user_id = admin_user.id
    
    if not args.confirm:
        print(f"⚠️  Tem certeza que deseja excluir o backup ID {args.backup_id}?")
        print("   Use --confirm para confirmar a exclusão")
        return False
    
    print(f"🗑️  Excluindo backup ID {args.backup_id}...")
    
    result = backup_service.delete_backup(args.backup_id, user_id)
    
    if result['success']:
        print(f"✅ {result['message']}")
        return True
    else:
        print(f"❌ Erro: {result['error']}")
        return False

def backup_info(args):
    """Mostra informações sobre um backup específico"""
    backup_service = BackupService(app)
    
    backups = backup_service.list_backups()
    backup = next((b for b in backups if b['id'] == args.backup_id), None)
    
    if not backup:
        print(f"❌ Backup ID {args.backup_id} não encontrado")
        return False
    
    print(f"📋 Informações do Backup ID {backup['id']}")
    print("-" * 50)
    print(f"📁 Arquivo: {backup['filename']}")
    print(f"📍 Caminho: {backup['file_path']}")
    print(f"📊 Tamanho: {round(backup['file_size'] / 1024 / 1024, 2) if backup['file_size'] else 0} MB")
    print(f"📅 Criado em: {backup['created_at']}")
    print(f"👤 Criado por: {backup['user_name']}")
    print(f"🔄 Status: {backup['status']}")
    
    if backup['status'] == 'error' and backup['error_message']:
        print(f"⚠️  Erro: {backup['error_message']}")
    
    # Verificar se arquivo existe
    if backup['file_path'] and os.path.exists(backup['file_path']):
        print(f"✅ Arquivo existe no sistema")
    else:
        print(f"❌ Arquivo não encontrado no sistema")
    
    return True

def schedule_backup(args):
    """Configura backup automático (placeholder)"""
    print("🕒 Funcionalidade de agendamento de backup")
    print("   Esta funcionalidade pode ser implementada usando:")
    print("   - Cron jobs no Linux")
    print("   - Task Scheduler no Windows")
    print("   - Celery para tarefas assíncronas")
    print()
    print("   Exemplo de cron job para backup diário às 2:00:")
    print("   0 2 * * * cd /caminho/para/projeto && python backup_cli.py create --type full")
    
    return True

def main():
    parser = argparse.ArgumentParser(
        description="Gerenciador de backups do ZG Planner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:
  python backup_cli.py create --type full          # Criar backup completo
  python backup_cli.py create --type schema_only   # Backup apenas do esquema
  python backup_cli.py create --type data_only     # Backup apenas dos dados
  python backup_cli.py list                        # Listar todos os backups
  python backup_cli.py info --backup-id 1          # Informações do backup ID 1
  python backup_cli.py delete --backup-id 1 --confirm  # Excluir backup ID 1
  python backup_cli.py schedule                    # Informações sobre agendamento
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Comandos disponíveis')
    
    # Comando create
    create_parser = subparsers.add_parser('create', help='Criar novo backup')
    create_parser.add_argument(
        '--type', 
        choices=['full', 'schema_only', 'data_only'], 
        default='full',
        help='Tipo de backup (padrão: full)'
    )
    
    # Comando list
    list_parser = subparsers.add_parser('list', help='Listar backups')
    
    # Comando delete
    delete_parser = subparsers.add_parser('delete', help='Excluir backup')
    delete_parser.add_argument('--backup-id', type=int, required=True, help='ID do backup')
    delete_parser.add_argument('--confirm', action='store_true', help='Confirmar exclusão')
    
    # Comando info
    info_parser = subparsers.add_parser('info', help='Informações do backup')
    info_parser.add_argument('--backup-id', type=int, required=True, help='ID do backup')
    
    # Comando schedule
    schedule_parser = subparsers.add_parser('schedule', help='Informações sobre agendamento')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    print(f"🚀 ZG Planner Backup Manager")
    print(f"⏰ {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print()
    
    try:
        if args.command == 'create':
            success = create_backup(args)
        elif args.command == 'list':
            success = list_backups(args)
        elif args.command == 'delete':
            success = delete_backup(args)
        elif args.command == 'info':
            success = backup_info(args)
        elif args.command == 'schedule':
            success = schedule_backup(args)
        else:
            print(f"❌ Comando desconhecido: {args.command}")
            return 1
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n⚠️  Operação cancelada pelo usuário")
        return 1
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        return 1

if __name__ == '__main__':
    sys.exit(main())

