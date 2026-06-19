# 📊 Relatório de Análise do Projeto

## 1. 🏗️ Visão Geral
- Nome do projeto: domus / tcc
  - Inferido por uso de marca no frontend: `frontend/src/components/Navbar.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Register.jsx`
  - Inferido por `backend/package.json`: `tcc`
  - Inferido por `frontend/package.json`: `frontend`
- Tecnologias principais identificadas:
  - Backend: Node.js, Express, Prisma ORM, MariaDB/MySQL, JWT, bcryptjs, Zod
  - Frontend: React, Vite, React Router DOM, Axios, Tailwind CSS
  - Banco de dados: MySQL/MariaDB via Prisma
- Linguagens utilizadas:
  - JavaScript
  - JSX
  - Prisma Schema
  - SQL
  - CSS
  - HTML
  - TypeScript em arquivo de configuração Prisma: `backend/prisma.config.ts`

## 2. 📂 Estrutura de Pastas
- `.git/` - Metadados de versionamento Git.
- `backend/` - Aplicação backend da API REST.
- `backend/generated/` - Cliente Prisma gerado.
- `backend/generated/prisma/` - Arquivos gerados do Prisma Client.
- `backend/generated/prisma/runtime/` - Runtime gerado do Prisma Client.
- `backend/node_modules/` - Dependências instaladas do backend.
- `backend/prisma/` - Schema Prisma e migrations do banco de dados.
- `backend/prisma/migrations/` - Histórico de migrations Prisma.
- `backend/prisma/migrations/20260528152533_init/` - Migration inicial com criação das tabelas.
- `backend/src/` - Código-fonte principal do backend.
- `backend/src/config/` - Configuração de ambiente e conexão Prisma.
- `backend/src/controllers/` - Controllers com regras das rotas HTTP.
- `backend/src/middleware/` - Middlewares de autenticação, autorização, validação e erro.
- `backend/src/routes/` - Definição das rotas Express.
- `backend/src/utils/` - Utilitários de UUID e logging.
- `backend/src/validators/` - Schemas de validação Zod.
- `frontend/` - Aplicação frontend React.
- `frontend/node_modules/` - Dependências instaladas do frontend.
- `frontend/public/` - Assets públicos servidos pelo Vite.
- `frontend/src/` - Código-fonte principal do frontend.
- `frontend/src/assets/` - Assets internos importáveis.
- `frontend/src/components/` - Componentes reutilizáveis.
- `frontend/src/context/` - Contextos React globais.
- `frontend/src/pages/` - Páginas da aplicação.
- `frontend/src/services/` - Serviços de comunicação externa, incluindo cliente HTTP.

## 3. ⚙️ Backend
**Localização:** `backend`

**Tecnologia(s):** JavaScript, Node.js, Express, Prisma ORM, MariaDB/MySQL, JWT, Zod

**Arquivos principais:**
- `backend/package.json` - Define scripts, tipo de módulo ES e dependências do backend.
- `backend/src/app.js` - Inicializa Express, valida ambiente, configura CORS, JSON, rotas em `/api` e middleware de erro.
- `backend/src/routes/index.js` - Agrega rotas de autenticação, usuários, categorias, skills, profissionais, propostas, serviços e avaliações.
- `backend/src/config/env.js` - Valida variáveis obrigatórias de ambiente.
- `backend/src/config/prisma.js` - Configura Prisma Client com adapter MariaDB.
- `backend/prisma/schema.prisma` - Define datasource, generator, enums e models do banco.
- `backend/prisma.config.ts` - Configuração Prisma para schema, migrations e datasource via `DATABASE_URL`.
- `backend/src/controllers/authController.js` - Cadastro, login e endpoint de usuário autenticado.
- `backend/src/controllers/userController.js` - Consulta pública de usuário, atualização e deleção lógica.
- `backend/src/controllers/serviceController.js` - CRUD parcial de serviços, listagem, detalhes, status e deleção lógica.
- `backend/src/controllers/proposalController.js` - Criação, listagem, consulta e atualização de status de propostas.
- `backend/src/controllers/professionalController.js` - Criação, consulta, atualização de perfil profissional e disponibilidade.
- `backend/src/controllers/reviewController.js` - Criação e listagem de avaliações por usuário e por serviço.
- `backend/src/controllers/categoryController.js` - Listagem de categorias.
- `backend/src/controllers/skillController.js` - Listagem de habilidades.
- `backend/src/middleware/authMiddleware.js` - Valida token JWT Bearer.
- `backend/src/middleware/roleMiddleware.js` - Valida papéis do usuário via banco.
- `backend/src/middleware/validateMiddleware.js` - Aplica validação Zod ao corpo da requisição.
- `backend/src/middleware/errorMiddleware.js` - Centraliza respostas para erros Prisma, JWT e erro genérico.
- `backend/src/utils/uuid.js` - Converte UUID entre string e buffer binário e gera UUID.
- `backend/src/utils/logger.js` - Logger simples para info e erro.
- `backend/src/validators/authValidator.js` - Valida cadastro e login.
- `backend/src/validators/userValidator.js` - Valida atualização de usuário.
- `backend/src/validators/serviceValidator.js` - Valida criação, atualização e status de serviços.
- `backend/src/validators/proposalValidator.js` - Valida criação e status de propostas.
- `backend/src/validators/professionalValidator.js` - Valida perfil profissional e disponibilidade.
- `backend/src/validators/reviewValidator.js` - Valida criação de avaliação.

**Funcionalidades implementadas:**
- Cadastro de usuário com hash de senha.
- Login com JWT.
- Consulta de usuário autenticado em `/api/auth/me`.
- Consulta pública de usuário por UUID.
- Atualização de usuário autenticado.
- Deleção lógica de usuário.
- Criação de perfil profissional.
- Atribuição de papel `professional` ao criar perfil profissional, quando o papel existir no banco.
- Consulta pública de perfil profissional.
- Atualização de perfil profissional.
- Atualização de disponibilidade profissional.
- Listagem de categorias com filhos.
- Listagem de habilidades.
- Criação de serviço por usuário com papel `client`.
- Listagem paginada de serviços abertos.
- Filtros de serviço por categoria e orçamento.
- Consulta de serviço por UUID.
- Atualização de serviço em rascunho pelo dono.
- Atualização de status de serviço com transições controladas.
- Deleção lógica de serviço.
- Criação de proposta por profissional.
- Listagem de propostas de um serviço para o cliente dono.
- Consulta de proposta por cliente ou profissional envolvido.
- Aceite, rejeição ou retirada de proposta.
- Ao aceitar proposta, atualização do serviço para `in_progress` e rejeição das demais propostas pendentes.
- Criação de avaliação para serviço concluído.
- Atualização de média e total de avaliações do profissional quando avaliado pelo cliente.
- Listagem paginada de avaliações por usuário.
- Listagem de avaliações por serviço.
- Validações de entrada com Zod em autenticação, usuários, serviços, propostas e perfis profissionais.
- Tratamento básico de erros.

## 4. 🗄️ Banco de Dados
**Tipo:** SQL, MySQL/MariaDB

**Localização da configuração:** `backend/prisma/schema.prisma`, `backend/prisma.config.ts`, `backend/src/config/prisma.js`, `backend/.env`, `backend/.env.example`

**Models/Entidades identificadas:**
- `Role` - Representa papéis de usuário, mapeado para tabela `roles`.
- `User` - Representa usuários, credenciais, dados pessoais, status de verificação e deleção lógica, mapeado para `users`.
- `UserRole` - Relação muitos-para-muitos entre usuários e papéis, mapeada para `user_roles`.
- `Category` - Categorias hierárquicas de serviços com relação pai/filhos, mapeada para `categories`.
- `Skill` - Habilidades profissionais cadastráveis, mapeada para `skills`.
- `ProfessionalProfile` - Perfil profissional de um usuário, incluindo bio, valor/hora, avaliação média, total de avaliações e disponibilidade, mapeado para `professional_profiles`.
- `ProfileSkill` - Relação entre perfil profissional e habilidade, com nível de proficiência, mapeada para `profile_skills`.
- `Service` - Serviço publicado por cliente, com categoria, orçamento, status, prazo e deleção lógica, mapeado para `services`.
- `Proposal` - Proposta enviada por profissional para um serviço, com preço, carta, prazo e status, mapeada para `proposals`.
- `Review` - Avaliação de um usuário sobre outro dentro de um serviço, mapeada para `reviews`.

**Enums identificados:**
- `AvailabilityStatus` - `available`, `busy`, `offline`.
- `ProficiencyLevel` - `beginner`, `intermediate`, `advanced`, `expert`.
- `ServiceStatus` - `draft`, `open`, `in_progress`, `completed`, `cancelled`.
- `ProposalStatus` - `pending`, `accepted`, `rejected`, `withdrawn`.

**Migrations:** Sim - `backend/prisma/migrations/20260528152533_init/migration.sql`

**Tabelas criadas pela migration:**
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

## 5. 🎨 Frontend
**Localização:** `frontend`

**Tecnologia(s):** React, Vite, React Router DOM, Axios, Tailwind CSS

**Arquivos principais:**
- `frontend/package.json` - Define scripts, dependências e devDependencies do frontend.
- `frontend/index.html` - HTML base com fonte Inter, favicon e root da aplicação.
- `frontend/vite.config.js` - Configura Vite com Tailwind CSS, React e React Compiler via Babel/Rolldown.
- `frontend/eslint.config.js` - Configura ESLint para JavaScript/JSX, React Hooks e React Refresh.
- `frontend/src/main.jsx` - Monta a aplicação React no DOM.
- `frontend/src/App.jsx` - Define roteamento principal e envolve a aplicação com `AuthProvider`.
- `frontend/src/services/api.js` - Configura cliente Axios com URL base e interceptor para token Bearer.
- `frontend/src/context/AuthContext.jsx` - Gerencia usuário, token, login, logout e persistência em localStorage.
- `frontend/src/components/Navbar.jsx` - Barra de navegação responsiva baseada em autenticação e papéis.
- `frontend/src/components/ProtectedRoute.jsx` - Componente de proteção por autenticação e papéis.
- `frontend/src/index.css` - Importa Tailwind CSS e define tema visual base.
- `frontend/src/App.css` - CSS remanescente de template/estrutura visual não importado em `App.jsx`.

**Páginas/Componentes identificados:**
- `frontend/src/pages/Home.jsx` - Lista serviços disponíveis com filtros por categoria e orçamento.
- `frontend/src/pages/Login.jsx` - Tela de login.
- `frontend/src/pages/Register.jsx` - Tela de cadastro.
- `frontend/src/pages/Profile.jsx` - Tela de perfil do usuário autenticado.
- `frontend/src/pages/CreateProfessionalProfile.jsx` - Criação de perfil profissional com habilidades.
- `frontend/src/pages/CreateService.jsx` - Publicação de serviço.
- `frontend/src/pages/MyServices.jsx` - Gerenciamento de serviços do usuário.
- `frontend/src/pages/ServiceDetail.jsx` - Detalhes de um serviço.
- `frontend/src/pages/ServiceProposals.jsx` - Listagem e decisão de propostas recebidas.
- `frontend/src/pages/SendProposal.jsx` - Envio de proposta por profissional.
- `frontend/src/pages/CreateReview.jsx` - Criação de avaliação para serviço concluído.
- `frontend/src/pages/ProfessionalProfile.jsx` - Visualização de perfil profissional.
- `frontend/src/components/Navbar.jsx` - Navegação principal.
- `frontend/src/components/ProtectedRoute.jsx` - Proteção de rotas, identificado mas não aplicado nas rotas atuais de `frontend/src/App.jsx`.

## 6. 🔗 Conexão Frontend-Backend
**Comunicação:** REST

**Método utilizado:** Axios

**Configuração da API:**
- URL base: `http://localhost:3000/api`, identificada em `frontend/src/services/api.js`.
- Variáveis de ambiente: NÃO IDENTIFICADO no frontend.
- Variáveis de ambiente do backend: `backend/.env` e `backend/.env.example`.
- Proxy: NÃO IDENTIFICADO em `frontend/vite.config.js`.
- CORS: configurado no backend em `backend/src/app.js`, com origem `http://localhost:5173` e `credentials: true`.
- Autenticação: token JWT salvo em `localStorage` e enviado como `Authorization: Bearer`, configurado em `frontend/src/services/api.js`.

**Endpoints consumidos pelo frontend:**
- `GET /categories` → `frontend/src/pages/Home.jsx`, `frontend/src/pages/CreateService.jsx`
- `GET /services` → `frontend/src/pages/Home.jsx`, `frontend/src/pages/MyServices.jsx`
- `GET /services/:uuid` → `frontend/src/pages/ServiceDetail.jsx`, `frontend/src/pages/CreateReview.jsx`
- `POST /services` → `frontend/src/pages/CreateService.jsx`
- `PATCH /services/:uuid/status` → `frontend/src/pages/MyServices.jsx`
- `DELETE /services/:uuid` → `frontend/src/pages/MyServices.jsx`
- `POST /services/:uuid/proposals` → `frontend/src/pages/SendProposal.jsx`
- `GET /services/:uuid/proposals` → `frontend/src/pages/ServiceProposals.jsx`
- `PATCH /proposals/:proposalUuid/status` → `frontend/src/pages/ServiceProposals.jsx`
- `POST /services/:uuid/reviews` → `frontend/src/pages/CreateReview.jsx`
- `POST /auth/login` → `frontend/src/pages/Login.jsx`
- `POST /auth/register` → `frontend/src/pages/Register.jsx`
- `GET /auth/me` → `frontend/src/pages/Profile.jsx`
- `PATCH /users/:uuid` → `frontend/src/pages/Profile.jsx`
- `GET /skills` → `frontend/src/pages/CreateProfessionalProfile.jsx`
- `POST /professionals` → `frontend/src/pages/CreateProfessionalProfile.jsx`
- `GET /professionals/:uuid` → `frontend/src/pages/ProfessionalProfile.jsx`

## 7. ✅ O Que Já Está Implementado
**Backend:**
- API REST com Express sob `/api`.
- Validação de variáveis de ambiente obrigatórias.
- CORS para frontend local.
- Serialização de BigInt para JSON.
- Cadastro de usuário.
- Login com JWT.
- Endpoint `/auth/me`.
- Hash de senha com bcryptjs.
- Middleware de autenticação JWT.
- Middleware de autorização por papel.
- Middleware de validação Zod.
- Middleware de erro.
- CRUD parcial de usuário com deleção lógica.
- Perfil profissional com skills e disponibilidade.
- Listagem de categorias.
- Listagem de skills.
- Serviços com criação, listagem, detalhes, atualização, status e deleção lógica.
- Propostas com criação, listagem, detalhe e mudança de status.
- Avaliações com criação, listagem por usuário e listagem por serviço.
- Atualização de estatísticas de avaliação do perfil profissional.
- Uso de UUID binário no banco com conversão para string na API.

**Frontend:**
- Aplicação React com Vite.
- Roteamento com React Router DOM.
- Contexto de autenticação com persistência em localStorage.
- Cliente Axios centralizado.
- Interceptor para envio de JWT.
- Navbar responsiva baseada em usuário e papéis.
- Tela de login.
- Tela de cadastro.
- Tela inicial com listagem e filtros de serviços.
- Tela de detalhes de serviço.
- Tela de perfil do usuário.
- Tela de criação de perfil profissional.
- Tela de criação de serviço.
- Tela de gerenciamento de serviços.
- Tela de envio de proposta.
- Tela de propostas recebidas.
- Tela de criação de avaliação.
- Tela pública de perfil profissional.
- Estilização principal com Tailwind CSS.

**Banco de Dados:**
- Tabelas já criadas na migration:
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
- Chaves primárias, índices, chaves únicas e relações estrangeiras definidos na migration inicial.
- Enums para disponibilidade, proficiência, status de serviço e status de proposta.

## 8. 🚧 O Que Parece Incompleto ou Em Desenvolvimento
- `backend/src/validators/reviewValidator.js` existe, mas `backend/src/routes/reviews.js` não aplica `validate(createReviewSchema)` na rota de criação de avaliação.
- `frontend/src/components/ProtectedRoute.jsx` existe, mas não é usado em `frontend/src/App.jsx`; as rotas comentadas como autenticadas não estão protegidas no roteamento.
- `backend/src/routes/index.js` registra `proposalRoutes` em `/proposals` e também em `/services`; isso cria rotas diferentes a partir do mesmo router, algumas com semântica ambígua.
- `backend/src/controllers/serviceController.js` usa logs de debug em `getService` e mensagens genéricas de logger como `nome_da_função`.
- `backend/src/middleware/roleMiddleware.js` usa `logger.error`, mas não importa `logger`.
- `backend/src/controllers/authController.js` cadastra usuário sem atribuir automaticamente papel `client`.
- `backend/prisma/migrations/20260528152533_init/migration.sql` cria tabelas, mas não insere dados iniciais para `roles`, `categories` ou `skills`.
- `frontend/src/pages/MyServices.jsx` busca `GET /services` com parâmetro `all: true`, mas `backend/src/controllers/serviceController.js` não trata esse parâmetro e lista apenas serviços com status `open`.
- `frontend/src/pages/MyServices.jsx` filtra por `service.client?.uuid`, mas `listServices` no backend não inclui `client` na resposta.
- `frontend/src/pages/CreateReview.jsx` exige digitação manual do UUID do usuário avaliado.
- `frontend/src/App.jsx` não possui rota dedicada para atualização de perfil profissional ou atualização de disponibilidade, embora o backend implemente esses endpoints.
- `frontend/src/App.css` mantém estilos de template e não foi identificado import ativo desse arquivo.
- `frontend/README.md` permanece com conteúdo padrão do template React + Vite.
- `backend/package.json` define script `start` como `node index.js`, mas o arquivo `backend/index.js` não foi identificado.
- Testes automatizados não foram identificados.
- Documentação específica do domínio do projeto não foi identificada.

## 9. 📦 Dependências Principais
**Backend:**
- `@prisma/adapter-mariadb` - `^7.8.0`
- `@prisma/client` - `^7.8.0`
- `bcryptjs` - `^3.0.3`
- `cors` - `^2.8.6`
- `dotenv` - `^17.4.2`
- `express` - `^5.2.1`
- `jsonwebtoken` - `^9.0.3`
- `zod` - `^4.4.3`
- `nodemon` - `^3.1.14`
- `prisma` - `^7.8.0`

**Frontend:**
- `@tailwindcss/vite` - `^4.3.0`
- `axios` - `^1.17.0`
- `react` - `^19.2.6`
- `react-dom` - `^19.2.6`
- `react-router-dom` - `^7.17.0`
- `tailwindcss` - `^4.3.0`
- `@babel/core` - `^7.29.0`
- `@eslint/js` - `^10.0.1`
- `@rolldown/plugin-babel` - `^0.2.3`
- `@types/react` - `^19.2.14`
- `@types/react-dom` - `^19.2.3`
- `@vitejs/plugin-react` - `^6.0.1`
- `babel-plugin-react-compiler` - `^1.0.0`
- `eslint` - `^10.3.0`
- `eslint-plugin-react-hooks` - `^7.1.1`
- `eslint-plugin-react-refresh` - `^0.5.2`
- `globals` - `^17.6.0`
- `vite` - `^8.0.12`

## 10. 🔍 Observações Adicionais
- Padrão de projeto identificado no backend: organização próxima a MVC, com separação em `routes`, `controllers`, `middleware`, `validators`, `config` e `utils`.
- Padrão de projeto identificado no frontend: SPA React organizada por `pages`, `components`, `context` e `services`.
- Arquitetura de comunicação: frontend SPA consumindo API REST via Axios.
- Autenticação: JWT stateless no backend, persistido em `localStorage` no frontend.
- Controle de autorização: baseado em papéis salvos no banco por meio de `roles` e `user_roles`.
- Persistência: Prisma ORM com MariaDB/MySQL e cliente gerado em `backend/generated/prisma`.
- Identificadores externos: UUIDs armazenados como `BINARY(16)` no banco e convertidos para formato textual na API.
- Deleção lógica: usuários e serviços usam campo `deletedAt`.
- Regras de negócio relevantes identificadas:
  - Serviços iniciam como `draft`.
  - Listagem pública retorna serviços `open`.
  - Serviços em `draft` podem ser editados.
  - Serviços em `in_progress` não podem ser deletados.
  - Propostas só podem ser enviadas para serviços `open`.
  - Cliente não pode propor no próprio serviço.
  - Aceitar uma proposta muda o serviço para `in_progress`.
  - Avaliações só podem ocorrer em serviços `completed`.
  - Usuário não pode avaliar a si mesmo.
- Pontos de atenção identificados:
  - Há dependência de dados iniciais não presentes em migration para papéis, categorias e habilidades.
  - Há divergências entre algumas expectativas do frontend e respostas/parametrizações implementadas no backend.
  - Há rotas marcadas visualmente como autenticadas no frontend sem uso do componente `ProtectedRoute`.
  - Há validação de review existente no backend, mas não aplicada na rota.
  - Há script de start no backend apontando para arquivo não identificado.
  - Não foram identificados arquivos de teste.
