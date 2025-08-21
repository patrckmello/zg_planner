import os
import json
import datetime
import subprocess
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from extensions import db
from models.backup_model import Backup
from models.audit_log_model import AuditLog
from sqlalchemy import text, inspect
import zipfile
import tempfile
from urllib.parse import urlparse

class BackupService:
    """Serviço completo de backup para o banco de dados ZG Planner"""
    pg_dump_path = r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
    
    def __init__(self, app=None):
        self.app = app
        self.backup_dir = os.path.join(os.getcwd(), 'backups')
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def create_full_backup(self, user_id, backup_type='full'):
        """
        Cria um backup completo do banco de dados
        
        Args:
            user_id: ID do usuário que está criando o backup
            backup_type: Tipo de backup ('full', 'schema_only', 'data_only')
        
        Returns:
            dict: Informações do backup criado
        """
        timestamp = datetime.datetime.now().strftime('%Y_%m_%d_%H_%M_%S')
        backup_name = f'zg_planner_backup_{backup_type}_{timestamp}'
        
        # Criar registro do backup
        backup = Backup(
            filename=f'{backup_name}.zip',
            status='pending',
            created_by=user_id
        )
        
        with self.app.app_context():
            db.session.add(backup)
            db.session.commit()
            
            try:
                # Criar diretório temporário para o backup
                with tempfile.TemporaryDirectory() as temp_dir:
                    backup_files = []
                    
                    # 1. Backup do esquema do banco
                    if backup_type in ['full', 'schema_only']:
                        schema_file = self._backup_schema(temp_dir, backup_name)
                        if schema_file:
                            backup_files.append(schema_file)
                    
                    # 2. Backup dos dados
                    if backup_type in ['full', 'data_only']:
                        data_files = self._backup_data(temp_dir, backup_name)
                        backup_files.extend(data_files)
                    
                    # 3. Backup de metadados
                    metadata_file = self._backup_metadata(temp_dir, backup_name)
                    if metadata_file:
                        backup_files.append(metadata_file)
                    
                    # 4. Criar arquivo ZIP com todos os backups
                    zip_path = os.path.join(self.backup_dir, f'{backup_name}.zip')
                    self._create_zip_backup(backup_files, zip_path)
                    
                    # Atualizar registro do backup
                    backup.file_path = zip_path
                    backup.file_size = os.path.getsize(zip_path)
                    backup.status = 'completed'
                    db.session.commit()
                    
                    # Log da ação
                    AuditLog.log_action(
                        user_id=user_id,
                        action='CREATE',
                        description=f'Criou backup completo: {backup.filename}',
                        resource_type='backup',
                        resource_id=backup.id
                    )
                    
                    return {
                        'success': True,
                        'backup': backup.to_dict(),
                        'message': 'Backup criado com sucesso'
                    }
                    
            except Exception as e:
                db.session.rollback() # Rollback em caso de erro
                backup.status = 'error'
                backup.error_message = str(e)
                db.session.commit()
                
                return {
                    'success': False,
                    'error': str(e),
                    'backup_id': backup.id
                }
    
    def _backup_schema(self, temp_dir, backup_name):
        """Faz backup do esquema do banco de dados"""
        try:
            schema_file = os.path.join(temp_dir, f'{backup_name}_schema.sql')
            
            # Obter URL do banco de dados
            database_url = os.getenv('DATABASE_URL')
            
            if database_url and database_url.startswith('postgresql'):
                # Backup PostgreSQL
                self._backup_postgresql_schema(database_url, schema_file)
            elif database_url and database_url.startswith('sqlite'):
                # Backup SQLite
                self._backup_sqlite_schema(database_url, schema_file)
            else:
                # Backup genérico usando SQLAlchemy
                self._backup_generic_schema(schema_file)
            
            return schema_file
            
        except Exception as e:
            print(f"Erro ao fazer backup do esquema: {e}")
            return None
    
    def _backup_postgresql_schema(self, database_url, schema_file):
        """Backup do esquema PostgreSQL usando pg_dump"""
        try:
            cmd = [
                self.pg_dump_path,
                '--no-owner',
                '--no-privileges',
                '--file', schema_file,
                database_url 
            ]

            # Se precisar passar senha sem prompt:
            env = os.environ.copy()
            parsed = urlparse(database_url)
            if parsed.password:
                env["PGPASSWORD"] = parsed.password

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300, env=env)

            if result.returncode != 0:
                raise Exception(f"Erro no pg_dump: {result.stderr}")

        except subprocess.TimeoutExpired:
            raise Exception("Timeout durante backup do esquema PostgreSQL")
        except FileNotFoundError:
            raise Exception("pg_dump não encontrado. Verifique o caminho em pg_dump_path.")
        except Exception as e:
            raise Exception(f"Erro ao executar pg_dump: {e}")

    
    def _backup_sqlite_schema(self, database_url, schema_file):
        """Backup do esquema SQLite"""
        db_path = database_url.replace('sqlite:///', '')
        
        with sqlite3.connect(db_path) as conn:
            with open(schema_file, 'w') as f:
                for line in conn.iterdump():
                    if 'CREATE TABLE' in line or 'CREATE INDEX' in line:
                        f.write(line + '\n')
    
    def _backup_generic_schema(self, schema_file):
        """Backup genérico do esquema usando SQLAlchemy"""
        with open(schema_file, 'w') as f:
            f.write("-- Backup do esquema ZG Planner\n")
            f.write(f"-- Criado em: {datetime.datetime.now()}\n\n")
            
            # Obter informações das tabelas
            tables_info = self._get_tables_info()
            
            for table_name, columns in tables_info.items():
                f.write(f"-- Tabela: {table_name}\n")
                f.write(f"CREATE TABLE {table_name} (\n")
                
                column_definitions = []
                for col in columns:
                    col_def = f"    {col['name']} {col['type']}"
                    if col.get('nullable') == False:
                        col_def += " NOT NULL"
                    if col.get('primary_key'):
                        col_def += " PRIMARY KEY"
                    column_definitions.append(col_def)
                
                f.write(",\n".join(column_definitions))
                f.write("\n);\n\n")
    
    def _backup_data(self, temp_dir, backup_name):
        """Faz backup dos dados de todas as tabelas"""
        data_files = []
        
        with self.app.app_context(): # Garante contexto da aplicação para operações de DB
            tables = self._get_table_names()
            
            for table_name in tables:
                try:
                    # Criar arquivo JSON para cada tabela
                    table_file = os.path.join(temp_dir, f'{backup_name}_data_{table_name}.json')
                    
                    # Exportar dados da tabela
                    table_data = self._export_table_data(table_name)
                    
                    with open(table_file, 'w', encoding='utf-8') as f:
                        json.dump(table_data, f, indent=2, ensure_ascii=False, default=str)
                    
                    data_files.append(table_file)
                    
                except Exception as e:
                    db.session.rollback() # Rollback para limpar o estado da sessão após erro em uma tabela
                    print(f"Erro ao fazer backup da tabela {table_name}: {e}")
                    continue
            
            return data_files
            
    
    def _backup_metadata(self, temp_dir, backup_name):
        """Cria arquivo com metadados do backup"""
        try:
            metadata_file = os.path.join(temp_dir, f'{backup_name}_metadata.json')
            
            metadata = {
                'backup_info': {
                    'name': backup_name,
                    'created_at': datetime.datetime.now().isoformat(),
                    'database_type': self._get_database_type(),
                    'version': '1.0'
                },
                'tables': self._get_tables_info(),
                'statistics': self._get_database_statistics()
            }
            
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False, default=str)
            
            return metadata_file
            
        except Exception as e:
            print(f"Erro ao criar metadados: {e}")
            return None
    
    def _create_zip_backup(self, files, zip_path):
        """Cria arquivo ZIP com todos os arquivos de backup"""
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in files:
                if os.path.exists(file_path):
                    # Adicionar arquivo ao ZIP com nome relativo
                    arcname = os.path.basename(file_path)
                    zipf.write(file_path, arcname)
    
    def _get_table_names(self):
        """Obtém lista de nomes das tabelas"""
        with self.app.app_context(): # Garante contexto da aplicação
            inspector = inspect(db.engine)
            return inspector.get_table_names()
    
    def _get_tables_info(self):
        """Obtém informações detalhadas das tabelas"""
        tables_info = {}
        with self.app.app_context(): # Garante contexto da aplicação
            inspector = inspect(db.engine)
            for table_name in inspector.get_table_names():
                columns_info = []
                for column in inspector.get_columns(table_name):
                    col_info = {
                        'name': column['name'],
                        'type': str(column['type']),
                        'nullable': column.get('nullable'),
                        'primary_key': column.get('primary_key'),
                        'foreign_key': bool(column.get('foreign_keys'))
                    }
                    columns_info.append(col_info)
                
                tables_info[table_name] = columns_info
            
            return tables_info
    
    def _export_table_data(self, table_name):
        """Exporta dados de uma tabela específica"""
        with self.app.app_context(): # Garante contexto da aplicação
            try:
                # Use db.session.execute().mappings().all() para obter resultados como dicionários
                result = db.session.execute(text(f"SELECT * FROM {table_name}")).mappings().all()
                
                if not result:
                    return {'table_name': table_name, 'columns': [], 'rows': []}

                columns = list(result[0].keys()) # Pega as chaves do primeiro registro para as colunas
                
                data = {
                    'table_name': table_name,
                    'columns': columns,
                    'rows': [dict(row) for row in result] # Converte cada MappingProxy para dict
                }
                
                return data
                
            except Exception as e:
                db.session.rollback() # Rollback para limpar o estado da sessão
                print(f"Erro ao exportar dados da tabela {table_name}: {e}")
                return {'table_name': table_name, 'error': str(e)}
    
    def _get_database_type(self):
        """Identifica o tipo de banco de dados"""
        database_url = os.getenv('DATABASE_URL', '')
        
        if database_url.startswith('postgresql'):
            return 'postgresql'
        elif database_url.startswith('sqlite'):
            return 'sqlite'
        elif database_url.startswith('mysql'):
            return 'mysql'
        else:
            return 'unknown'
    
    def _get_database_statistics(self):
        """Obtém estatísticas do banco de dados"""
        stats = {}
        with self.app.app_context(): # Garante contexto da aplicação
            try:
                tables = self._get_table_names()
                
                for table_name in tables:
                    try:
                        result = db.session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                        count = result.scalar()
                        stats[table_name] = {'row_count': count}
                    except Exception as e:
                        db.session.rollback() # Rollback em caso de erro
                        stats[table_name] = {'row_count': 'error', 'error_message': str(e)}
                
            except Exception as e:
                db.session.rollback() # Rollback em caso de erro
                stats['error'] = str(e)
            
            return stats
    
    def restore_backup(self, backup_id, user_id):
        """
        Restaura um backup (funcionalidade básica)
        ATENÇÃO: Esta operação pode sobrescrever dados existentes
        """
        with self.app.app_context():
            backup = Backup.query.get(backup_id)
            
            if not backup or backup.status != 'completed':
                return {'success': False, 'error': 'Backup não encontrado ou inválido'}
            
            if not os.path.exists(backup.file_path):
                return {'success': False, 'error': 'Arquivo de backup não encontrado'}
            
            try:
                # Log da ação
                AuditLog.log_action(
                    user_id=user_id,
                    action='RESTORE',
                    description=f'Iniciou restauração do backup: {backup.filename}',
                    resource_type='backup',
                    resource_id=backup_id
                )
                
                # Aqui você implementaria a lógica de restauração
                # Por segurança, apenas retornamos informações do backup
                
                return {
                    'success': True,
                    'message': 'Funcionalidade de restauração disponível',
                    'backup_info': backup.to_dict(),
                    'warning': 'Restauração deve ser feita manualmente por segurança'
                }
                
            except Exception as e:
                db.session.rollback() # Rollback em caso de erro
                return {'success': False, 'error': str(e)}
    
    def list_backups(self):
        """Lista todos os backups disponíveis"""
        with self.app.app_context():
            backups = Backup.query.order_by(Backup.created_at.desc()).all()
            return [backup.to_dict() for backup in backups]
    
    def delete_backup(self, backup_id, user_id):
        """Exclui um backup específico"""
        with self.app.app_context():
            backup = Backup.query.get(backup_id)
            
            if not backup:
                return {'success': False, 'error': 'Backup não encontrado'}
            
            try:
                # Remover arquivo do sistema
                if backup.file_path and os.path.exists(backup.file_path):
                    os.remove(backup.file_path)
                
                filename = backup.filename
                
                # Remover registro do banco
                db.session.delete(backup)
                db.session.commit()
                
                # Log da ação
                AuditLog.log_action(
                    user_id=user_id,
                    action='DELETE',
                    description=f'Excluiu backup: {filename}',
                    resource_type='backup',
                    resource_id=backup_id
                )
                
                return {'success': True, 'message': 'Backup excluído com sucesso'}
                
            except Exception as e:
                db.session.rollback() # Rollback em caso de erro
                return {'success': False, 'error': str(e)}

