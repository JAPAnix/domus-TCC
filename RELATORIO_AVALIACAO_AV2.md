# Relatório Técnico e Avaliação AV2 - Projeto Domus

## 1. Visão Geral do Projeto

**Nome identificado:** Domus  
**Repositório remoto:** `https://github.com/JAPAnix/domus-TCC.git`  
**Estrutura principal:** frontend e backend separados em pastas próprias.

O projeto é uma aplicação web para conectar clientes e profissionais por meio de serviços, propostas, perfis profissionais e avaliações.

## 2. Tecnologias Identificadas

### Backend

- Node.js
- Express
- Prisma ORM
- MariaDB/MySQL
- JWT
- bcryptjs
- Zod
- CORS

### Frontend

- React
- JavaScript
- Vite
- React Router DOM
- Axios
- Tailwind CSS

### Banco de Dados

- SQL
- MySQL/MariaDB
- Prisma Schema
- Prisma Migrations

## 3. Estrutura do Projeto

```text
domus-TCC/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── validators/
│   ├── package.json
│   ├── package-lock.json
│   └── prisma.config.ts
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── services/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── README.md
├── RELATORIO_ANALISE.md
└── RELATORIO_AVALIACAO_AV2.md
```

## 4. Análise do Backend

**Localização:** `backend`

O backend está estruturado com Express, Prisma e organização por camadas.

### Arquivos principais

- `backend/src/app.js` - Inicializa o servidor Express, configura CORS, JSON, rotas e middleware de erro.
- `backend/src/routes/index.js` - Agrupa as rotas da API.
- `backend/src/config/prisma.js` - Configura o Prisma Client com adapter MariaDB.
- `backend/src/config/env.js` - Valida variáveis de ambiente obrigatórias.
- `backend/prisma/schema.prisma` - Define models, enums e relações do banco.
- `backend/prisma/migrations/20260528152533_init/migration.sql` - Cria as tabelas principais do banco.

### Funcionalidades identificadas

- Cadastro de usuário.
- Login com JWT.
- Consulta de usuário autenticado.
- Atualização de perfil de usuário.
- Deleção lógica de usuário.
- Criação e consulta de perfil profissional.
- Atualização de perfil profissional.
- Atualização de disponibilidade profissional.
- Listagem de categorias.
- Listagem de habilidades.
- Criação de serviço.
- Listagem de serviços.
- Consulta de serviço por UUID.
- Atualização de serviço.
- Atualização de status de serviço.
- Deleção lógica de serviço.
- Criação de proposta.
- Listagem de propostas.
- Consulta de proposta.
- Atualização de status de proposta.
- Criação de avaliação.
- Listagem de avaliações por usuário.
- Listagem de avaliações por serviço.

## 5. Análise do Banco de Dados

**Tipo:** MySQL/MariaDB  
**ORM:** Prisma  
**Schema:** `backend/prisma/schema.prisma`  
**Migration:** `backend/prisma/migrations/20260528152533_init/migration.sql`

### Entidades identificadas

- `Role`
- `User`
- `UserRole`
- `Category`
- `Skill`
- `ProfessionalProfile`
- `ProfileSkill`
- `Service`
- `Proposal`
- `Review`

### Tabelas criadas na migration

- `roles`
- `users`
- `user_roles`
- `categories`
- `skills`
- `professional_profiles`
- `profile_skills`
- `services`
- `proposals`
- `reviews`

### Avaliação do banco

O banco possui estrutura coerente com um MVP de marketplace de serviços, incluindo usuários, papéis, categorias, profissionais, habilidades, serviços, propostas e avaliações.

No repositório local foi identificada a estrutura do banco por meio do Prisma e da migration. A criação do banco em servidor de produção não pôde ser verificada apenas pelos arquivos locais.

## 6. Análise do Frontend

**Localização:** `frontend`

O frontend está iniciado em React com JavaScript, Vite e Tailwind CSS.

### Arquivos principais

- `frontend/src/App.jsx` - Define as rotas da aplicação.
- `frontend/src/main.jsx` - Inicializa a aplicação React.
- `frontend/src/services/api.js` - Configura Axios com URL base do backend.
- `frontend/src/context/AuthContext.jsx` - Gerencia autenticação no frontend.
- `frontend/src/components/Navbar.jsx` - Navbar responsiva.
- `frontend/src/components/ProtectedRoute.jsx` - Componente de proteção de rotas.
- `frontend/src/index.css` - Importa Tailwind e define tema visual.

### Páginas identificadas

- `Home.jsx` - Lista serviços disponíveis.
- `Login.jsx` - Login.
- `Register.jsx` - Cadastro.
- `Profile.jsx` - Perfil do usuário.
- `CreateProfessionalProfile.jsx` - Criação de perfil profissional.
- `CreateService.jsx` - Criação de serviço.
- `MyServices.jsx` - Gerenciamento de serviços.
- `ServiceDetail.jsx` - Detalhes de serviço.
- `SendProposal.jsx` - Envio de proposta.
- `ServiceProposals.jsx` - Propostas recebidas.
- `CreateReview.jsx` - Criação de avaliação.
- `ProfessionalProfile.jsx` - Visualização de perfil profissional.

## 7. Conexão Frontend-Backend

**Comunicação:** REST  
**Cliente HTTP:** Axios  
**Arquivo:** `frontend/src/services/api.js`  
**URL base:** `http://localhost:3000/api`

### Endpoints consumidos pelo frontend

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `PATCH /users/:uuid`
- `GET /categories`
- `GET /skills`
- `GET /services`
- `GET /services/:uuid`
- `POST /services`
- `PATCH /services/:uuid/status`
- `DELETE /services/:uuid`
- `POST /services/:uuid/proposals`
- `GET /services/:uuid/proposals`
- `PATCH /proposals/:uuid/status`
- `POST /services/:uuid/reviews`
- `POST /professionals`
- `GET /professionals/:uuid`

O projeto demonstra conexão inicial entre frontend e backend, com telas consumindo e enviando dados para rotas da API.

## 8. Verificação Contra os Critérios da AV2

Documento analisado: **AV2 - Projeto Integrado de Sistemas - Estruturação inicial do projeto e início do desenvolvimento**.

### Critério 1 - Organização do repositório, README e professor como colaborador

**Valor:** 1,5 ponto  
**Situação:** Parcialmente atende

### Evidências positivas

- O repositório possui separação entre `backend/` e `frontend/`.
- Há estrutura mínima de pastas.
- Há arquivos de configuração.
- Há histórico de commits.
- Foi identificado remote GitHub: `https://github.com/JAPAnix/domus-TCC.git`.
- Foram identificados commits de mais de um autor.

### Pendências ou pontos não verificados

- Não há `README.md` na raiz do projeto.
- O `frontend/README.md` ainda é o README padrão do Vite.
- Não foi possível verificar se o professor foi adicionado como colaborador.
- O README não apresenta nome do projeto, problema, objetivo, funcionalidades do MVP, tecnologias, instruções para rodar e divisão frontend/backend/banco.

**Estimativa:** 0,6 / 1,5

## Critério 2 - Banco de dados criado e coerente com o MVP

**Valor:** 2,0 pontos  
**Situação:** Parcialmente atende

### Evidências positivas

- Existe `backend/prisma/schema.prisma`.
- Existe migration SQL em `backend/prisma/migrations/20260528152533_init/migration.sql`.
- As tabelas principais foram modeladas.
- Há chaves primárias, estrangeiras, índices e relações.
- A modelagem é coerente com o domínio do projeto.

### Pendências ou pontos não verificados

- Não foi possível confirmar se o banco foi criado no servidor de produção.
- Não foram encontrados prints ou demonstrações das tabelas criadas.
- Não foram encontrados seeds ou inserts iniciais para `roles`, `categories` e `skills`.

**Estimativa:** 1,4 / 2,0

## Critério 3 - Arquivo exportado do Insomnia com rotas organizadas

**Valor:** 1,5 ponto  
**Situação:** Não atende no repositório local

### Evidências positivas

- O backend possui várias rotas implementadas.
- As rotas estão organizadas por responsabilidade em `backend/src/routes`.

### Pendências

- Não foi encontrado arquivo exportado do Insomnia.
- Não foram encontrados arquivos como collection, environment ou export de API.
- Não é possível verificar exemplos de requisições, corpos JSON e organização no Insomnia.

**Estimativa:** 0 / 1,5

## Critério 4 - Backend iniciado com integração ao banco usando Prisma ORM

**Valor:** 2,0 pontos  
**Situação:** Atende bem

### Evidências positivas

- Backend em Node.js com Express.
- Servidor configurado em `backend/src/app.js`.
- Prisma ORM configurado.
- Conexão com MariaDB/MySQL configurada.
- Schema Prisma completo.
- Controllers executam consultas, cadastros, atualizações e deleções lógicas com Prisma.
- Rotas retornam JSON.
- Há validação de dados com Zod.

### Pontos de atenção

- `backend/package.json` possui script `start` apontando para `index.js`, mas esse arquivo não foi encontrado.
- `backend/src/middleware/roleMiddleware.js` usa `logger`, mas não importa o utilitário.
- Algumas mensagens de log ainda parecem provisórias.

**Estimativa:** 1,8 / 2,0

## Critério 5 - Frontend iniciado em React, JavaScript e Tailwind

**Valor:** 1,5 ponto  
**Situação:** Atende

### Evidências positivas

- Projeto criado com React e Vite.
- Usa JavaScript e JSX.
- Usa Tailwind CSS.
- Possui telas principais iniciadas.
- Possui componentes organizados.
- Possui navegação com React Router DOM.
- Possui contexto de autenticação.
- Possui cliente Axios para API.

### Pontos de atenção

- O componente `ProtectedRoute.jsx` existe, mas não está aplicado em `App.jsx`.
- O README do frontend ainda é o padrão do template.

**Estimativa:** 1,5 / 1,5

## Critério 6 - Conexão inicial entre frontend e backend

**Valor:** 1,0 ponto  
**Situação:** Atende

### Evidências positivas

- `frontend/src/services/api.js` configura Axios para `http://localhost:3000/api`.
- O backend configura CORS para `http://localhost:5173`.
- O frontend consome endpoints reais do backend.
- Há telas fazendo GET, POST, PATCH e DELETE.
- Há envio de token JWT via interceptor.

### Pontos de atenção

- A URL da API está fixa no código, não em variável de ambiente.
- Algumas expectativas do frontend não batem totalmente com o backend, como a tela `MyServices.jsx` usando parâmetro `all: true`, que não é tratado no controller de serviços.

**Estimativa:** 1,0 / 1,0

## Critério 7 - Clareza na apresentação e divisão de tarefas do grupo

**Valor:** 0,5 ponto  
**Situação:** Não verificável pelo repositório local

### Evidências positivas

- Há commits de mais de um autor.
- O projeto possui relatório técnico gerado em `RELATORIO_ANALISE.md`.

### Pendências ou pontos não verificados

- Não há documento claro com divisão de tarefas.
- Não há planejamento explícito do que será feito em seguida.
- A apresentação em sala não pode ser avaliada pelos arquivos locais.

**Estimativa:** 0,2 / 0,5

## 9. Estimativa Geral de Pontuação

| Critério | Valor | Estimativa |
|---|---:|---:|
| Organização do repositório, README e professor colaborador | 1,5 | 0,6 |
| Banco de dados criado e coerente com o MVP | 2,0 | 1,4 |
| Arquivo exportado do Insomnia | 1,5 | 0 |
| Backend com Prisma ORM | 2,0 | 1,8 |
| Frontend React, JavaScript e Tailwind | 1,5 | 1,5 |
| Conexão frontend-backend | 1,0 | 1,0 |
| Clareza na apresentação e divisão de tarefas | 0,5 | 0,2 |
| **Total estimado localmente** | **10,0** | **6,5** |

## 10. Conclusão

Com base apenas no repositório local, o projeto **atende bem aos critérios técnicos de desenvolvimento**, principalmente backend, frontend e conexão inicial entre as camadas.

Os maiores riscos de perda de nota estão nos **entregáveis formais da AV2**:

- README atualizado.
- Arquivo exportado do Insomnia.
- Comprovação do banco de dados em produção.
- Print ou demonstração das tabelas criadas.
- Professor adicionado como colaborador.
- Documento ou fala clara sobre divisão de tarefas e próximos passos.

Se esses itens existirem fora do repositório e forem apresentados no Google Classroom ou em sala, a pontuação real pode ser maior que a estimativa local.

## 11. Resultado Final da Verificação

**O projeto atende parcialmente aos critérios da AV2.**

### Atende

- Backend iniciado com Prisma ORM.
- Estrutura backend organizada.
- Banco modelado com tabelas principais.
- Frontend iniciado com React, JavaScript e Tailwind.
- Telas principais iniciadas.
- Comunicação inicial entre frontend e backend.

### Atende parcialmente

- Organização do repositório.
- Banco de dados, pois a modelagem existe, mas a produção não foi verificada.
- Divisão de tarefas, pois há commits de múltiplos autores, mas não há documentação clara.

### Não atende ou não foi encontrado

- README completo do projeto.
- Export do Insomnia.
- Comprovação de professor como colaborador.
- Prints ou demonstração das tabelas no servidor de produção.
