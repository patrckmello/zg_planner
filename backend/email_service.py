import smtplib
import os
from email.mime.base import MIMEBase
from email import encoders
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import pytz
from dotenv import load_dotenv

load_dotenv()

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('MAIL_PORT', 587))
        self.use_tls = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
        self.username = os.getenv('MAIL_USERNAME')
        self.password = os.getenv('MAIL_PASSWORD')
        self.max_attachment_mb = int(os.getenv('MAIL_MAX_ATTACHMENT_MB', 20))
        self.default_sender_name = os.getenv('MAIL_DEFAULT_SENDER_NAME', 'ZG Planner')
        self.default_sender_email = os.getenv('MAIL_DEFAULT_SENDER_EMAIL')
        self.brazil_tz = pytz.timezone('America/Sao_Paulo')
    
    def send_email(self, to_email, subject, body, is_html=False, attachments=None):
        try:
            msg = MIMEMultipart()
            msg['From'] = f"{self.default_sender_name} <{self.default_sender_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject

            if is_html:
                msg.attach(MIMEText(body, 'html', 'utf-8'))
            else:
                msg.attach(MIMEText(body, 'plain', 'utf-8'))

            # anexos (opcional)
            total_attach_bytes = 0
            for path in (attachments or []):
                if os.path.isfile(path):
                    total_attach_bytes += os.path.getsize(path)

            if attachments and total_attach_bytes > self.max_attachment_mb * 1024 * 1024:
                av = f"\n\n(Aviso: anexos ultrapassaram {self.max_attachment_mb}MB; envio sem anexos.)"
                msg.attach(MIMEText(av, 'plain', 'utf-8') if not is_html else MIMEText(f"<p><em>{av}</em></p>", 'html', 'utf-8'))
            else:
                for path in (attachments or []):
                    if not os.path.isfile(path):
                        continue
                    with open(path, 'rb') as f:
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f'attachment; filename="{os.path.basename(path)}"')
                    msg.attach(part)

            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            if self.use_tls:
                server.starttls()
            server.login(self.username, self.password)
            server.sendmail(self.default_sender_email, to_email, msg.as_string())
            server.quit()
            return True
        except Exception as e:
            print(f"Erro ao enviar e-mail para {to_email}: {str(e)}")
            return False
    
    def send_task_reminder(self, user_email, user_name, task_title, task_description, due_date, reminder_type):
        if due_date.tzinfo is None:
            due_date = pytz.utc.localize(due_date)
        
        due_date_brazil = due_date.astimezone(self.brazil_tz)
        formatted_date = due_date_brazil.strftime("%d/%m/%Y às %H:%M")
        
        subject = f"🔔 Lembrete: {task_title}"
        
        body = f"""
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background-color: #4CAF50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 8px 8px 0 0;
                }}
                .content {{
                    background-color: #f9f9f9;
                    padding: 20px;
                    border: 1px solid #ddd;
                }}
                .task-info {{
                    background-color: white;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 15px 0;
                    border-left: 4px solid #4CAF50;
                }}
                .reminder-badge {{
                    background-color: #ff9800;
                    color: white;
                    padding: 5px 10px;
                    border-radius: 15px;
                    font-size: 12px;
                    display: inline-block;
                    margin-bottom: 10px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #666;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>ZG Planner - Lembrete de Tarefa</h2>
            </div>
            
            <div class="content">
                <p>Olá, <strong>{user_name}</strong>!</p>
                
                <div class="reminder-badge">
                    Lembrete: {reminder_type}
                </div>
                
                <div class="task-info">
                    <h3>📋 {task_title}</h3>
                    <p><strong>Descrição:</strong> {task_description or 'Sem descrição'}</p>
                    <p><strong>📅 Data de vencimento:</strong> {formatted_date}</p>
                </div>
                
                <p>Esta é uma notificação automática para lembrá-lo(a) sobre sua tarefa.</p>
                <p>Acesse o ZG Planner para mais detalhes e para marcar como concluída.</p>
            </div>
            
            <div class="footer">
                <p>Este é um e-mail automático do ZG Planner. Não responda a este e-mail.</p>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(user_email, subject, body, is_html=True)
    
    def send_backup_weekly(self, to_email, filename, created_at_utc, file_size_bytes, attachment_path=None, admin_url=None):

        if created_at_utc.tzinfo is None:
            created_at_utc = pytz.utc.localize(created_at_utc)
        created_br = created_at_utc.astimezone(self.brazil_tz)

        # Formatação de data e tamanho
        formatted_date = created_br.strftime("%d/%m/%Y às %H:%M")
        size_mb = round((file_size_bytes or 0) / (1024 * 1024), 2)

        subject = f"[ZG Planner] Backup semanal: {filename}"

        # Badge e bloco de info igual ao reminder (cores/estilos harmônicos)
        body = f"""
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #ffffff;
                }}
                .header {{
                    background-color: #4CAF50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 8px 8px 0 0;
                }}
                .content {{
                    background-color: #f9f9f9;
                    padding: 20px;
                    border: 1px solid #ddd;
                }}
                .info-box {{
                    background-color: white;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 15px 0;
                    border-left: 4px solid #4CAF50;
                }}
                .badge {{
                    background-color: #2196F3;
                    color: white;
                    padding: 5px 10px;
                    border-radius: 15px;
                    font-size: 12px;
                    display: inline-block;
                    margin-bottom: 10px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #666;
                }}
                .btn {{
                    display: inline-block;
                    padding: 10px 16px;
                    border-radius: 6px;
                    background: #4CAF50;
                    color: #fff !important;
                    text-decoration: none;
                    font-weight: bold;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>ZG Planner - Backup semanal</h2>
            </div>

            <div class="content">
                <div class="badge">Backup semanal</div>

                <p>Segue o backup mais recente disponível.</p>

                <div class="info-box">
                    <p><strong>📦 Arquivo:</strong> {filename}</p>
                    <p><strong>🕒 Gerado em:</strong> {formatted_date}</p>
                    <p><strong>🗜️ Tamanho:</strong> {size_mb} MB</p>
                </div>

                <p>Observação: caso o anexo não esteja presente, ele excedeu o limite configurado e foi omitido automaticamente.</p>
                {f'<p><a class="btn" href="{admin_url}" target="_blank" rel="noopener">Abrir painel de backups</a></p>' if admin_url else ''}
            </div>

            <div class="footer">
                <p>Este é um e-mail automático do ZG Planner. Não responda a este e-mail.</p>
            </div>
        </body>
        </html>
        """

        # Delegar envio ao método base (mantém lógica de anexos/tamanho)
        attachments = [attachment_path] if attachment_path else None
        return self.send_email(to_email, subject, body, is_html=True, attachments=attachments)

    def get_brazil_time(self):
        return datetime.now(self.brazil_tz)
    
    def convert_to_brazil_time(self, utc_datetime):
        if utc_datetime.tzinfo is None:
            utc_datetime = pytz.utc.localize(utc_datetime)
        
        return utc_datetime.astimezone(self.brazil_tz)

email_service = EmailService()

