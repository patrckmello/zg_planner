import smtplib
import os
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
        self.default_sender_name = os.getenv('MAIL_DEFAULT_SENDER_NAME', 'ZG Planner')
        self.default_sender_email = os.getenv('MAIL_DEFAULT_SENDER_EMAIL')
        
        # Configurar timezone do Brasil (GMT-3)
        self.brazil_tz = pytz.timezone('America/Sao_Paulo')
    
    def send_email(self, to_email, subject, body, is_html=False):
        """
        Envia um e-mail
        
        Args:
            to_email (str): E-mail do destinatário
            subject (str): Assunto do e-mail
            body (str): Corpo do e-mail
            is_html (bool): Se o corpo é HTML ou texto simples
        
        Returns:
            bool: True se enviado com sucesso, False caso contrário
        """
        try:
            # Criar mensagem
            msg = MIMEMultipart()
            msg['From'] = f"{self.default_sender_name} <{self.default_sender_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Anexar corpo da mensagem
            if is_html:
                msg.attach(MIMEText(body, 'html', 'utf-8'))
            else:
                msg.attach(MIMEText(body, 'plain', 'utf-8'))
            
            # Conectar ao servidor SMTP
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            
            if self.use_tls:
                server.starttls()
            
            server.login(self.username, self.password)
            
            # Enviar e-mail
            text = msg.as_string()
            server.sendmail(self.default_sender_email, to_email, text)
            server.quit()
            
            print(f"E-mail enviado com sucesso para {to_email}")
            return True
            
        except Exception as e:
            print(f"Erro ao enviar e-mail para {to_email}: {str(e)}")
            return False
    
    def send_task_reminder(self, user_email, user_name, task_title, task_description, due_date, reminder_type):
        """
        Envia lembrete de tarefa
        
        Args:
            user_email (str): E-mail do usuário
            user_name (str): Nome do usuário
            task_title (str): Título da tarefa
            task_description (str): Descrição da tarefa
            due_date (datetime): Data de vencimento da tarefa
            reminder_type (str): Tipo do lembrete (ex: "1 hora antes")
        
        Returns:
            bool: True se enviado com sucesso, False caso contrário
        """
        # Converter data para timezone do Brasil
        if due_date.tzinfo is None:
            due_date = pytz.utc.localize(due_date)
        
        due_date_brazil = due_date.astimezone(self.brazil_tz)
        
        # Formatar data
        formatted_date = due_date_brazil.strftime("%d/%m/%Y às %H:%M")
        
        subject = f"🔔 Lembrete: {task_title}"
        
        # Corpo do e-mail em HTML
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
    
    def get_brazil_time(self):
        """
        Retorna o horário atual no Brasil (GMT-3)
        """
        return datetime.now(self.brazil_tz)
    
    def convert_to_brazil_time(self, utc_datetime):
        """
        Converte datetime UTC para horário do Brasil
        """
        if utc_datetime.tzinfo is None:
            utc_datetime = pytz.utc.localize(utc_datetime)
        
        return utc_datetime.astimezone(self.brazil_tz)

# Instância global do serviço de e-mail
email_service = EmailService()

