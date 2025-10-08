# 🗂️ ZG Planner

> **Planejamento inteligente, colaboração eficiente.**  
> O **ZG Planner** é uma plataforma web interna desenvolvida para o escritório **Zavagna Gralha Advogados**, com o objetivo de **otimizar o gerenciamento de tarefas e projetos** entre equipes jurídicas e administrativas.  
> Focada em produtividade, segurança e praticidade, a ferramenta centraliza atividades, aprovações e relatórios em um ambiente moderno e escalável.

---

## 🚀 Visão Geral

O **ZG Planner** nasceu para substituir planilhas e controles manuais por uma solução unificada de **gestão de tarefas e equipes**.  
Com uma arquitetura **Flask + React + PostgreSQL**, o sistema oferece controle total sobre o ciclo de vida das tarefas — da criação à conclusão — com automações, auditoria e relatórios em tempo real.

O projeto é resultado do trabalho interno de inovação do setor de TI do escritório, priorizando **eficiência, transparência e organização**.

---

## 🧩 Principais Funcionalidades

### 🔐 Autenticação e Perfis de Acesso
- Login seguro com **JWT (JSON Web Tokens)**.  
- Perfis com diferentes níveis de permissão (administrador, gestor, colaborador).  
- Controle de sessão e rotas protegidas no frontend.

### ✅ Gestão de Tarefas
- Criação, edição, exclusão e atribuição de tarefas.  
- Campos de prioridade, status, prazos e observações.  
- Atribuição a usuários ou equipes específicas.  
- Histórico e auditoria automática das ações.  
- Upload de **anexos** vinculados a cada tarefa.  

### 🧭 Painel Kanban Interativo
- Visualização de tarefas por **status** (“A fazer”, “Em andamento”, “Concluído”).  
- **Drag & Drop** fluido e responsivo (usando *dnd-kit*).  
- Cards com informações resumidas e expansão para detalhes.  
- Indicadores visuais de prioridade e prazo.

### 👥 Gestão de Usuários, Equipes e Cargos (Admin)
- Criação e edição de **equipes** com gestores e membros.  
- Associação de usuários a equipes e cargos.  
- Modais administrativos para gerenciamento de membros.  
- Controle granular de permissões e vínculos.

### 📊 Relatórios e Estatísticas
- Relatórios de produtividade por equipe e por usuário.  
- Filtros de tarefas por status, categoria e período.  
- Separação entre tarefas **concluídas** e **arquivadas**.  
- Exportação e visualização amigável dos dados.

### 📬 Sistema de Aprovação e Notificações
- Envio de tarefas para **aprovação de gestores**.  
- Notificações automáticas por e-mail (aprovação, rejeição e conclusão).  
- Integração com **Outlook/SMTP**, via fila assíncrona (Outbox Worker).  
- Logs de entrega e tratamento de erros.

### ♻️ Automação e Agendamento
- **Arquivamento automático** de tarefas concluídas há mais de 7 dias.  
- **Rotina de backups automáticos** diários.  
- **Registro de auditoria** de todas as ações no sistema.

### 💾 Backup e Restauração
- Geração de backups compactados (.zip) com data e hora.  
- Armazenamento local e logs de execução.  
- Integração com o módulo de agendamento (APScheduler).

---

## 🧱 Arquitetura e Tecnologias

| Camada | Principais Tecnologias |
|:--|:--|
| **Frontend** | React, React Router DOM, Axios, React Toastify, dnd-kit, Lucide React, CSS Modules |
| **Backend** | Flask, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-Migrate, Flask-CORS, APScheduler |
| **Banco de Dados** | PostgreSQL |
| **Outros** | Alembic, python-dotenv, Psycopg2-binary |

---

## 🏗️ Estrutura do Projeto

```
zg_planner/
├── backend/
│   ├── app.py
│   ├── models/
│   ├── routes/
│   ├── jobs/
│   ├── services/
│   ├── migrations/
│   ├── backups/
│   └── utils/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   └── assets/
│   └── public/
└── README.md
```

---

## ⚙️ Configuração e Execução Local

### Pré-requisitos
- **Python ≥ 3.10**  
- **Node.js ≥ 16**  
- **PostgreSQL**

### 1. Clonar o repositório
```bash
git clone https://github.com/patrckmello/zg_planner.git
cd zg_planner
```

### 2. Configurar o Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # (Windows)
# ou source venv/bin/activate (Linux/macOS)

pip install -r requirements.txt
flask db upgrade
python app.py
```
Servidor disponível em **http://localhost:5555**

### 3. Configurar o Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Aplicação disponível em **http://localhost:5174**

---

## 📞 Contato

Desenvolvido por **Patrick Mello**  
📧 patrick.mello@zavagnagralha.com.br  
💼 Zavagna Gralha Advogados — Assistente de TI
