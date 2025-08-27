# ZG Planner

## Visão Geral do Projeto

O ZG Planner é uma plataforma web robusta e escalável, projetada para otimizar o gerenciamento de tarefas e a colaboração em equipes. Desenvolvido com uma arquitetura moderna e tecnologias de ponta, o sistema oferece um conjunto abrangente de funcionalidades para planejamento, execução e monitoramento de projetos, visando aumentar a produtividade e a eficiência operacional de organizações de diversos portes.

Com uma interface intuitiva e recursos poderosos, o ZG Planner capacita usuários e administradores a gerenciar fluxos de trabalho complexos, atribuir responsabilidades, acompanhar o progresso em tempo real e gerar insights valiosos através de relatórios detalhados. A segurança e a integridade dos dados são pilares fundamentais, garantindo um ambiente confiável para todas as operações.

## Módulos e Funcionalidades Chave

O ZG Planner é composto por módulos interconectados que oferecem uma experiência completa de gerenciamento:

- **Módulo de Autenticação e Autorização**: Implementa um sistema de login seguro baseado em JWT (JSON Web Tokens), com controle de acesso granular através de perfis de usuário e funções (administrador, gerente, membro da equipe, etc.).
- **Módulo de Gerenciamento de Tarefas**: Permite a criação, edição, atribuição e acompanhamento de tarefas com atributos detalhados, incluindo prazos, prioridades, status, anexos e colaboradores. Suporta diferentes visualizações para adaptabilidade ao fluxo de trabalho.
- **Kanban Board Interativo**: Oferece uma representação visual dinâmica do progresso das tarefas, facilitando a organização e a movimentação de itens entre diferentes estágios do ciclo de vida do projeto.
- **Módulo de Gerenciamento de Usuários e Funções (Admin)**: Ferramentas administrativas para o controle completo sobre a base de usuários, incluindo a criação de novas contas, atribuição e modificação de cargos e gerenciamento de permissões de acesso.
- **Módulo de Gerenciamento de Equipes**: Funcionalidades para estruturar e organizar equipes, permitindo a associação de usuários a grupos específicos para otimizar a colaboração e a distribuição de tarefas.
- **Módulo de Relatórios e Análises**: Geração de relatórios customizáveis e dashboards para análise de desempenho de tarefas e equipes, fornecendo métricas e insights para tomadas de decisão estratégicas.
- **Perfis de Usuário Personalizáveis**: Cada usuário possui um perfil dedicado para gerenciar informações pessoais, preferências e visualizar suas tarefas e atividades.
- **Configurações do Sistema (Admin)**: Painel de controle para administradores configurarem parâmetros globais da aplicação, garantindo a adaptabilidade às necessidades organizacionais.
- **Sistema de Notificações e Lembretes**: Mecanismo proativo para alertar usuários sobre prazos iminentes, atualizações de tarefas e outras informações críticas, garantindo que nenhuma atividade importante seja perdida.
- **Módulo de Backup e Recuperação de Dados**: Implementa rotinas de backup automatizadas para assegurar a persistência e a recuperação de dados em caso de falhas, protegendo informações críticas do projeto.
- **Gerenciamento de Anexos**: Suporte para upload e associação de arquivos a tarefas, centralizando documentos e recursos relevantes.

## Arquitetura e Tecnologias

O ZG Planner adota uma arquitetura cliente-servidor desacoplada, com um frontend moderno e um backend robusto, comunicando-se através de uma API RESTful. A escolha das tecnologias reflete um compromisso com a performance, escalabilidade e manutenibilidade.

### Frontend

Desenvolvido para oferecer uma experiência de usuário fluida e responsiva, o frontend utiliza:

- **React**: A biblioteca JavaScript líder para construção de interfaces de usuário declarativas e baseadas em componentes.
- **React Router DOM**: Gerenciamento de roteamento para navegação eficiente entre as diferentes seções da aplicação.
- **React Toastify**: Biblioteca para notificações de usuário, proporcionando feedback visual e contextual.
- **Dnd-kit**: Um conjunto de ferramentas de arrastar e soltar para React, fundamental para a interatividade do Kanban Board.
- **Phosphor React**: Uma coleção de ícones flexíveis e personalizáveis, aprimorando a estética e a usabilidade.
- **Axios**: Cliente HTTP baseado em Promises para comunicação assíncrona com a API do backend.
- **CSS Modules**: Abordagem para modularização de estilos CSS, prevenindo conflitos e promovendo a reutilização de código.

### Backend

Construído para ser performático e seguro, o backend é implementado com:

- **Flask**: Um microframework web em Python, conhecido por sua simplicidade e flexibilidade, utilizado para desenvolver a API RESTful.
- **Flask-SQLAlchemy**: Uma extensão que integra o poderoso ORM SQLAlchemy ao Flask, facilitando a interação com o banco de dados relacional.
- **SQLAlchemy**: O ORM Python de fato, oferecendo um mapeamento objeto-relacional completo para manipulação de dados.
- **Flask-Migrate (Alembic)**: Ferramenta essencial para gerenciar e aplicar migrações de esquema de banco de dados de forma controlada.
- **Flask-CORS**: Middleware para habilitar o compartilhamento de recursos de origem cruzada (CORS), permitindo a comunicação segura entre frontend e backend.
- **Flask-JWT-Extended**: Extensão para implementar autenticação baseada em JSON Web Tokens, garantindo a segurança das requisições à API.
- **Psycopg2-binary**: Adaptador de banco de dados PostgreSQL para Python, otimizado para performance.
- **python-dotenv**: Utilizado para carregar variáveis de ambiente de um arquivo `.env`, protegendo informações sensíveis.
- **APScheduler**: Uma biblioteca de agendamento de tarefas para Python, empregada para automatizar backups e o envio de lembretes.
- **Serviço de E-mail**: Componente dedicado para o envio de notificações e lembretes por e-mail, integrado ao sistema de agendamento.

### Banco de Dados

- **PostgreSQL**: Um sistema de gerenciamento de banco de dados relacional de código aberto, conhecido por sua robustez, escalabilidade e conformidade com padrões SQL. Utilizado para armazenar todos os dados da aplicação.

## Configuração e Execução Local

Para configurar e executar o ZG Planner em seu ambiente de desenvolvimento local, siga as instruções detalhadas abaixo. Certifique-se de que todos os pré-requisitos estejam instalados antes de prosseguir.

### Pré-requisitos

As seguintes ferramentas e ambientes são necessários:

- **Node.js**: Versão 14.x ou superior (inclui `npm`). Alternativamente, `Yarn` pode ser utilizado.
- **Python**: Versão 3.8.x ou superior (inclui `pip`).
- **PostgreSQL**: Um servidor de banco de dados PostgreSQL em execução e acessível.

### 1. Clonagem do Repositório

Inicie clonando o repositório do ZG Planner para sua máquina local:

```bash
git clone https://github.com/patrckmello/zg_planner.git
cd zg_planner
```

### 2. Configuração do Backend

Navegue até o diretório do backend e configure o ambiente Python:

```bash
cd backend
```

Crie e ative um ambiente virtual para isolar as dependências do projeto:

```bash
python3 -m venv venv
source venv/bin/activate  # No Windows: .\venv\Scripts\activate
```

Instale todas as dependências Python listadas no `requirements.txt`:

```bash
pip install -r requirements.txt
```

Crie um arquivo de configuração de ambiente `.env` na raiz do diretório `backend` com as seguintes variáveis. Substitua os valores entre aspas pelos seus dados de conexão com o PostgreSQL e uma chave secreta forte:

```dotenv
DATABASE_URL="postgresql://seu_usuario:sua_senha@localhost:5432/seu_banco_de_dados"
SECRET_KEY="sua_chave_secreta_para_flask"
```

**Importante**: Certifique-se de que o banco de dados especificado em `DATABASE_URL` (`seu_banco_de_dados`) já esteja criado no seu servidor PostgreSQL.

Inicialize o banco de dados e execute as migrações para criar o esquema necessário:

```bash
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
python init_db.py
```

Finalmente, inicie o servidor backend:

```bash
python app.py
```

O servidor backend estará acessível em `http://localhost:5555`.

### 3. Configuração do Frontend

Abra um novo terminal e navegue até o diretório do frontend:

```bash
cd ../frontend
```

Instale as dependências JavaScript utilizando npm ou Yarn:

```bash
npm install  # ou yarn install
```

Inicie a aplicação frontend:

```bash
npm run dev  # ou yarn dev
```

O frontend será executado e estará disponível em `http://localhost:5173` (a porta pode variar dependendo da configuração do Vite).

## Estrutura do Projeto

O repositório do ZG Planner é organizado de forma modular, refletindo a separação entre as camadas de frontend e backend:

```
zg_planner/
├── backend/                # Contém todo o código-fonte e configurações do servidor Flask (API RESTful).
│   ├── migrations/         # Scripts de migração de banco de dados gerenciados pelo Alembic.
│   ├── models/             # Definições dos modelos de dados e esquemas de banco de dados (SQLAlchemy).
│   ├── routes/             # Módulos que definem os endpoints da API e a lógica de roteamento.
│   ├── app.py              # Ponto de entrada principal da aplicação Flask.
│   ├── requirements.txt    # Lista de dependências Python necessárias para o backend.
│   └── ...                 # Outros arquivos de configuração e utilitários do backend.
├── frontend/               # Contém todo o código-fonte da aplicação React.
│   ├── public/             # Ativos estáticos como `favicon.ico` e imagens globais.
│   ├── src/                # Diretório principal do código-fonte React.
│   │   ├── assets/         # Imagens, ícones e outros recursos estáticos utilizados na UI.
│   │   ├── components/     # Componentes React reutilizáveis (botões, modais, etc.).
│   │   ├── pages/          # Componentes React que representam as diferentes páginas da aplicação.
│   │   ├── services/       # Lógica de comunicação com a API do backend (e.g., `axiosInstance.js`).
│   │   ├── utils/          # Funções utilitárias e helpers globais (e.g., `jwt.js`).
│   │   ├── App.jsx         # Componente raiz da aplicação React, responsável pelo roteamento.
│   │   └── main.jsx        # Ponto de entrada principal para a renderização da aplicação React.
│   └── ...                 # Outros arquivos de configuração do frontend (e.g., `package.json`, `vite.config.js`).
├── .gitignore              # Define arquivos e diretórios a serem ignorados pelo controle de versão do Git.
├── README.md               # Este documento, fornecendo uma visão geral e instruções do projeto.
└── ...                     # Outros arquivos de configuração ou documentação na raiz do projeto.
```

## Contribuição

Contribuições são bem-vindas! Se você deseja contribuir para o projeto ZG Planner, por favor, siga as diretrizes de contribuição e o código de conduta. Abra uma issue para discutir novas funcionalidades ou melhorias, ou envie um pull request com suas alterações.

## Contato

Para dúvidas, sugestões ou suporte, entre em contato com [patrckmello](https://github.com/patrckmello).

---

