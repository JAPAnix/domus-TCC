# Relatório Técnico do Projeto Domus

## 1. Visão Geral

**Nome do projeto:** Domus  
**Nome técnico identificado no backend:** `tcc`  
**Nome técnico identificado no frontend:** `frontend`

O projeto é uma aplicação web para intermediar a relação entre clientes e profissionais. A estrutura permite cadastro e login de usuários, criação de perfis profissionais, publicação de serviços, envio de propostas e avaliações.

## 2. Tecnologias Utilizadas

### Backend

- Node.js
- Express
- Prisma ORM
- MariaDB/MySQL
- JWT
- bcryptjs
- Zod
- CORS
- Nodemon

### Frontend

- React
- JavaScript
- Vite
- React Router DOM
- Axios
- Tailwind CSS
- ESLint

### Banco de Dados

- MySQL/MariaDB
- Prisma Schema
- Prisma Migrations

## 3. Estrutura de Pastas

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
├── RELATORIO_AVALIACAO_AV2.md
└── RELATORIO_PROJETO.md
```

### Responsabilidades das pastas

- `backend/` - API, regras de negócio, integração com banco e autenticação.
- `backend/prisma/` - Schema Prisma e migrations do banco.
- `backend/src/config/` - Configurações de ambiente e Prisma.
- `backend/src/controllers/` - Lógica executada pelas rotas.
- `backend/src/middleware/` - Autenticação, autorização, validação e tratamento de erros.
- `backend/src/routes/` - Definição das rotas HTTP.
- `backend/src/utils/` - Funções auxiliares.
- `backend/src/validators/` - Schemas de validação com Zod.
- `frontend/` - Interface web.
- `frontend/public/` - Arquivos públicos.
- `frontend/src/assets/` - Imagens e assets internos.
- `frontend/src/components/` - Componentes reutilizáveis.
- `frontend/src/context/` - Contextos React.
- `frontend/src/pages/` - Telas da aplicação.
- `frontend/src/services/` - Comunicação com API.

## 4. Backend

**Localização:** `backend`  
**Tecnologia principal:** Node.js com Express  
**Banco/ORM:** MySQL/MariaDB com Prisma ORM

### Arquivos principais

- `backend/src/app.js` - Inicializa o servidor Express, configura CORS, JSON, rotas e middleware de erro.
- `backend/src/routes/index.js` - Centraliza as rotas da API.
- `backend/src/config/env.js` - Valida variáveis de ambiente obrigatórias.
- `backend/src/config/prisma.js` - Configura a conexão do Prisma com MariaDB.
- `backend/prisma/schema.prisma` - Define models, enums e relacionamentos.
- `backend/prisma.config.ts` - Configuração do Prisma.
- `backend/src/utils/uuid.js` - Converte UUID entre string e buffer.
- `backend/src/utils/logger.js` - Logger simples da aplicação.

### Controllers

- `authController.js` - Cadastro, login e usuário autenticado.
- `userController.js` - Consulta, atualização e deleção lógica de usuário.
- `professionalController.js` - Perfil profissional e disponibilidade.
- `serviceController.js` - Serviços, filtros, status e deleção lógica.
- `proposalController.js` - Propostas e alteração de status.
- `reviewController.js` - Avaliações.
- `categoryController.js` - Categorias.
- `skillController.js` - Habilidades.

### Middlewares

- `authMiddleware.js` - Verifica token JWT.
- `roleMiddleware.js` - Verifica papéis do usuário.
- `validateMiddleware.js` - Valida corpo das requisições com Zod.
- `errorMiddleware.js` - Trata erros gerais, Prisma e JWT.

### Funcionalidades implementadas no backend

- Cadastro de usuários.
- Login com token JWT.
- Consulta do usuário autenticado.
- Atualização de dados do usuário.
- Deleção lógica de usuário.
- Criação de perfil profissional.
- Consulta de perfil profissional.
- Atualização de perfil profissional.
- Atualização de disponibilidade.
- Listagem de categorias.
- Listagem de habilidades.
- Criação de serviços.
- Listagem de serviços.
- Filtros por categoria e orçamento.
- Consulta de serviço por UUID.
- Atualização de serviço.
- Atualização de status de serviço.
- Deleção lógica de serviço.
- Criação de propostas.
- Listagem de propostas por serviço.
- Consulta de proposta.
- Aceite, rejeição e retirada de proposta.
- Criação de avaliações.
- Listagem de avaliações por usuário.
- Listagem de avaliações por serviço.

## 5. Banco de Dados

**Tipo:** SQL  
**Banco configurado:** MySQL/MariaDB  
**Schema:** `backend/prisma/schema.prisma`  
**Migration:** `backend/prisma/migrations/20260528152533_init/migration.sql`

### Entidades identificadas

- `Role` - Papéis de usuário.
- `User` - Usuários da aplicação.
- `UserRole` - Relação entre usuários e papéis.
- `Category` - Categorias de serviços.
- `Skill` - Habilidades profissionais.
- `ProfessionalProfile` - Perfil profissional.
- `ProfileSkill` - Relação entre perfil profissional e habilidades.
- `Service` - Serviços publicados.
- `Proposal` - Propostas enviadas para serviços.
- `Review` - Avaliações entre usuários.

### Tabelas criadas

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

### Enums identificados

- `AvailabilityStatus`
- `ProficiencyLevel`
- `ServiceStatus`
- `ProposalStatus`

## 6. Frontend

**Localização:** `frontend`  
**Tecnologia principal:** React com Vite  
**Estilização:** Tailwind CSS

### Arquivos principais

- `frontend/src/main.jsx` - Inicializa a aplicação React.
- `frontend/src/App.jsx` - Define o roteamento principal.
- `frontend/src/services/api.js` - Configura Axios para comunicação com backend.
- `frontend/src/context/AuthContext.jsx` - Gerencia autenticação no frontend.
- `frontend/src/components/Navbar.jsx` - Navegação principal.
- `frontend/src/components/ProtectedRoute.jsx` - Proteção de rotas por autenticação/papel.
- `frontend/src/index.css` - Configuração visual com Tailwind.
- `frontend/vite.config.js` - Configuração do Vite.

### Páginas

- `Home.jsx` - Lista serviços disponíveis.
- `Login.jsx` - Login.
- `Register.jsx` - Cadastro.
- `Profile.jsx` - Perfil do usuário.
- `CreateProfessionalProfile.jsx` - Criação de perfil profissional.
- `ProfessionalProfile.jsx` - Perfil público profissional.
- `CreateService.jsx` - Criação de serviço.
- `MyServices.jsx` - Gerenciamento de serviços.
- `ServiceDetail.jsx` - Detalhes do serviço.
- `SendProposal.jsx` - Envio de proposta.
- `ServiceProposals.jsx` - Visualização e decisão de propostas.
- `CreateReview.jsx` - Criação de avaliação.

## 7. Integração Frontend-Backend

**Tipo de comunicação:** REST  
**Cliente HTTP:** Axios  
**Arquivo de configuração:** `frontend/src/services/api.js`  
**URL base configurada:** `http://localhost:3000/api`

O frontend envia o token JWT pelo header `Authorization: Bearer` usando interceptor do Axios.

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

## 8. Dependências Principais

### Backend

- `express` - `^5.2.1`
- `@prisma/client` - `^7.8.0`
- `@prisma/adapter-mariadb` - `^7.8.0`
- `prisma` - `^7.8.0`
- `jsonwebtoken` - `^9.0.3`
- `bcryptjs` - `^3.0.3`
- `zod` - `^4.4.3`
- `cors` - `^2.8.6`
- `dotenv` - `^17.4.2`
- `nodemon` - `^3.1.14`

### Frontend

- `react` - `^19.2.6`
- `react-dom` - `^19.2.6`
- `react-router-dom` - `^7.17.0`
- `axios` - `^1.17.0`
- `tailwindcss` - `^4.3.0`
- `@tailwindcss/vite` - `^4.3.0`
- `vite` - `^8.0.12`
- `@vitejs/plugin-react` - `^6.0.1`
- `eslint` - `^10.3.0`

## 9. Pontos Já Implementados

### Backend

- API REST estruturada.
- Rotas separadas por domínio.
- Controllers para principais recursos.
- Prisma configurado.
- Schema e migration do banco.
- Autenticação com JWT.
- Hash de senha.
- Validações com Zod.
- Middlewares de autenticação, autorização e erro.

### Frontend

- Aplicação React iniciada.
- Rotas de navegação.
- Contexto de autenticação.
- Consumo de API com Axios.
- Telas principais do MVP iniciadas.
- Interface estilizada com Tailwind.

### Banco

- Modelagem relacional criada.
- Migration inicial presente.
- Relacionamentos definidos entre usuários, serviços, propostas e avaliações.

## 10. Pontos de Atenção

- Não há `README.md` na raiz do projeto.
- O `frontend/README.md` ainda contém conteúdo padrão do Vite.
- O script `start` do backend aponta para `index.js`, mas esse arquivo não foi identificado.
- O componente `ProtectedRoute.jsx` existe, mas não está aplicado nas rotas em `App.jsx`.
- O validator de review existe, mas não foi identificado uso dele na rota de criação de avaliação.
- O backend depende de dados iniciais como papéis, categorias e habilidades, mas não foi identificado seed.
- O frontend usa URL fixa da API em vez de variável de ambiente.
- A tela `MyServices.jsx` envia parâmetro `all: true`, mas o controller de serviços não trata esse parâmetro.
- Não foram identificados testes automatizados.
- Não foi identificado arquivo exportado do Insomnia.

## 11. Conclusão

O projeto Domus já possui uma base técnica bem estruturada, com backend, frontend e banco de dados separados. O backend apresenta integração real com Prisma ORM e possui rotas para as principais funcionalidades do sistema. O frontend está iniciado em React, possui múltiplas telas e já se comunica com o backend por Axios.

O projeto atende bem ao estágio de desenvolvimento inicial, principalmente nos pontos de estruturação técnica, modelagem do banco, criação de rotas e integração frontend-backend. Os principais pontos pendentes estão relacionados à documentação, ajustes de integração fina entre algumas telas e controllers, configuração de ambiente e ausência de testes/export do Insomnia.
