import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.office365.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "True").lower() in ['true', '1', 'yes']
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_DEFAULT_SENDER_NAME = os.getenv("MAIL_DEFAULT_SENDER_NAME", "TI Zavagna Gralha")
MAIL_DEFAULT_SENDER_EMAIL = os.getenv("MAIL_DEFAULT_SENDER_EMAIL", MAIL_USERNAME)
MAIL_DEFAULT_SENDER = f"{MAIL_DEFAULT_SENDER_NAME} <{MAIL_DEFAULT_SENDER_EMAIL}>"

def enviar_email_reminder(destinatario, assunto, corpo):
    print(f"[MAIL] Tentando enviar e-mail para {destinatario} com assunto '{assunto}'")
    print(f"[MAIL] Config: SERVER={MAIL_SERVER}, PORT={MAIL_PORT}, USERNAME={MAIL_USERNAME}, TLS={MAIL_USE_TLS}")
    
    if not all([MAIL_USERNAME, MAIL_PASSWORD, destinatario]):
        print("[MAIL] Configuração de e-mail ou destinatário ausente.")
        return False
    if not all([MAIL_USERNAME, MAIL_PASSWORD, destinatario]):
        print("[MAIL] Configuração de e-mail ou destinatário ausente.")
        return False

    msg = EmailMessage()
    msg['Subject'] = assunto
    msg['From'] = MAIL_DEFAULT_SENDER
    msg['To'] = destinatario
    msg.set_content(corpo)

    try:
        with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
            if MAIL_USE_TLS:
                server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.send_message(msg)
        print(f"[MAIL] E-mail enviado com sucesso para {destinatario}")
        return True
    except Exception as e:
        print(f"[MAIL] Erro ao enviar e-mail: {repr(e)}")  # Aqui, mais detalhado com repr()
        return False