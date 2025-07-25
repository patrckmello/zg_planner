from datetime import datetime, timedelta
from models.task_model import Task
from models.user_model import User
from utils.mail import enviar_email_reminder
from flask import current_app

def interpretar_lembrete(lembrete_str, due_date):
    try:
        if lembrete_str.endswith('d'):
            dias = int(lembrete_str[:-1])
            return due_date - timedelta(days=dias)
        elif lembrete_str.endswith('h'):
            horas = int(lembrete_str[:-1])
            return due_date - timedelta(hours=horas)
        elif lembrete_str.endswith('min'):
            minutos = int(lembrete_str[:-3])
            return due_date - timedelta(minutes=minutos)
        else:
            # tenta interpretar como datetime direto
            return datetime.fromisoformat(lembrete_str)
    except Exception as e:
        print(f"[WARN] Não consegui interpretar lembrete '{lembrete_str}': {e}")
        # fallback: tenta datetime direto mesmo assim
        try:
            return datetime.fromisoformat(lembrete_str)
        except Exception:
            raise

def agendar_lembretes(scheduler):
    with current_app.app_context():
        tarefas = Task.query.all()
        now = datetime.now()

        for task in tarefas:
            if not task.lembretes or not task.due_date:
                continue
            user = User.query.get(task.user_id)
            if not user or not user.email:
                continue
            for lembrete in task.lembretes:
                try:
                    lembrete_dt = interpretar_lembrete(lembrete, task.due_date)
                    if lembrete_dt > now:
                        job_id = f"lembrete_{task.id}_{lembrete_dt.isoformat()}"
                        if scheduler.get_job(job_id):
                            scheduler.remove_job(job_id)
                        scheduler.add_job(
                            enviar_email_reminder,
                            'date',
                            run_date=lembrete_dt,
                            args=[
                                user.email,
                                f"[Lembrete] {task.title}",
                                f"Olá {user.username},\n\nEste é um lembrete da tarefa:\n\n{task.description or 'Sem descrição.'}"
                            ],
                            id=job_id
                        )
                        print(f"[Scheduler] Agendado lembrete {job_id} para {lembrete_dt}")
                except Exception as e:
                    print(f"[Scheduler] Erro ao agendar lembrete da task {task.id}: {e}")
