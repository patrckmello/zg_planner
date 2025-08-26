import threading
import time
from datetime import datetime, timedelta
import pytz
from models.task_model import Task
from models.user_model import User
from email_service import email_service
from extensions import db
import json
import os

SENT_REMINDERS_FILE = os.path.join(os.path.dirname(__file__), 'sent_reminders.txt')

class ReminderScheduler:
    def __init__(self, app):
        self.app = app
        self.running = False
        self.thread = None
        self.brazil_tz = pytz.timezone('America/Sao_Paulo')
        self.sent_reminders_file = os.path.join(os.getcwd(), 'sent_reminders.txt')
        self.reminder_minutes = {
            '5min': 5,
            '15min': 15,
            '30min': 30,
            '1h': 60,
            '1d': 1440,
            '1w': 10080
        }
        self.sent_reminders_cache = set()

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._run_scheduler, daemon=True)
            self.thread.start()
            print("Scheduler de lembretes iniciado")
    
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
        print("Scheduler de lembretes parado")
    
    def _run_scheduler(self):
        while self.running:
            try:
                self._check_reminders()
                time.sleep(60)
            except Exception as e:
                print(f"Erro no scheduler de lembretes: {str(e)}")
                time.sleep(60)
    
    def _check_reminders(self):
        try:
            with self.app.app_context():
                tasks = Task.query.filter(
                    Task.lembretes.isnot(None),
                    Task.status != 'completed',
                    Task.due_date.isnot(None)
                ).all()

                current_time = datetime.now(self.brazil_tz)

                for task in tasks:
                    if not task.lembretes or not task.due_date:
                        continue

                    # Garantir que a due_date está em UTC
                    task_due_date_utc = task.due_date
                    if task_due_date_utc.tzinfo is None:
                        task_due_date_utc = pytz.utc.localize(task_due_date_utc)

                    # Converte para horário do Brasil
                    task_due_date_brazil = task_due_date_utc.astimezone(self.brazil_tz)

                    for reminder_type in task.lembretes:
                        if reminder_type in self.reminder_minutes:
                            minutes_before = self.reminder_minutes[reminder_type]
                            reminder_time = task_due_date_brazil - timedelta(minutes=minutes_before)

                            # Chave do lembrete padronizada (sem microsegundos)
                            reminder_key = f"{task.id}_{reminder_type}_{task_due_date_brazil.strftime('%Y-%m-%dT%H:%M:%S')}"

                            if current_time >= reminder_time and not self._was_reminder_sent(reminder_key):
                                self._send_reminder(task, reminder_type, reminder_key)

        except Exception as e:
            print(f"Erro ao verificar lembretes: {str(e)}")


    def _send_reminder(self, task, reminder_type, reminder_key):
        try:
            with self.app.app_context():
                user = User.query.get(task.user_id)
                if not user or not user.email:
                    print(f"Usuário não encontrado ou sem e-mail para tarefa {task.id}")
                    return

                reminder_display = self._format_reminder_type(reminder_type)

                success = email_service.send_task_reminder(
                    user_email=user.email,
                    user_name=user.username,
                    task_title=task.title,
                    task_description=task.description,
                    due_date=task.due_date,
                    reminder_type=reminder_display
                )

                if success:
                    self._mark_reminder_sent(reminder_key)
                    print(f"Lembrete enviado para {user.email} - Tarefa: {task.title} - Tipo: {reminder_display}")
                else:
                    print(f"Falha ao enviar lembrete para {user.email} - Tarefa: {task.title}")
        except Exception as e:
            print(f"Erro ao enviar lembrete para tarefa {task.id}: {str(e)}")

    def _format_reminder_type(self, reminder_type):
        formats = {
            '5_minutes': '5 minutos antes',
            '15_minutes': '15 minutos antes',
            '30_minutes': '30 minutos antes',
            '1_hour': '1 hora antes',
            '1_day': '1 dia antes',
            '1_week': '1 semana antes'
        }
        return formats.get(reminder_type, reminder_type)

    def _was_reminder_sent(self, reminder_key):
        if reminder_key in self.sent_reminders_cache:
            return True
        try:
            with open(SENT_REMINDERS_FILE, 'r') as f:
                sent_reminders = f.read().splitlines()
                if reminder_key in sent_reminders:
                    self.sent_reminders_cache.add(reminder_key)
                    return True
        except FileNotFoundError:
            pass
        return False

    def _mark_reminder_sent(self, reminder_key):
        if reminder_key in self.sent_reminders_cache:
            return
        self.sent_reminders_cache.add(reminder_key)
        try:
            with open(SENT_REMINDERS_FILE, 'a') as f:
                f.write(f"{reminder_key}\n")
        except Exception as e:
            print(f"Erro ao marcar lembrete como enviado: {str(e)}")
    
    def schedule_task_reminders(self, task):
        if not task.lembretes or not task.due_date:
            return
        
        print(f"Lembretes agendados para tarefa '{task.title}': {task.lembretes}")
        if task.due_date.tzinfo is None:
            task_due_date = pytz.utc.localize(task.due_date)
        else:
            task_due_date = task.due_date
        
        task_due_date_brazil = task_due_date.astimezone(self.brazil_tz)
        for reminder_type in task.lembretes:
            if reminder_type in self.reminder_minutes:
                minutes_before = self.reminder_minutes[reminder_type]
                reminder_time = task_due_date_brazil - timedelta(minutes=minutes_before)
                print(f"  - {self._format_reminder_type(reminder_type)}: {reminder_time.strftime('%d/%m/%Y às %H:%M')}")

# Instância global inicializada como None
reminder_scheduler = None

def init_reminder_scheduler(app):
    """Inicializa o scheduler de lembretes"""
    global reminder_scheduler
    reminder_scheduler = ReminderScheduler(app)
    reminder_scheduler.start()

def stop_reminder_scheduler():
    """Para o scheduler de lembretes"""
    if reminder_scheduler:
        reminder_scheduler.stop()

def schedule_task_reminders_safe(task):
    """Função helper segura para agendar lembretes de uma tarefa"""
    if reminder_scheduler:
        reminder_scheduler.schedule_task_reminders(task)
