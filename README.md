# Dommos

Monorepositório: `frontend/` contém React 19, Vite 8, Tailwind e React Router (`createBrowserRouter`/`RouterProvider`); `backend/` contém Express 5, JavaScript ESM, Prisma 7 e o adapter MariaDB para MySQL. Cada diretório tem seu próprio `package.json` e lockfile. Não execute instalação na raiz.

Use Node **24.x, a partir de 24.11.1 e abaixo de 25**, nos dois projetos. A auditoria usou 24.11.1. Prefira o patch de segurança mais recente da linha 24 em produção. No Render selecione essa linha explicitamente com `NODE_VERSION=24`.

Scripts: frontend `dev`, `build`, `preview`, `lint`; backend `dev`, `start`, `test`, `db:seed`. O backend não precisa de compilação JavaScript; precisa gerar o Prisma Client.

## Deploy

**Estado: PRONTO COM PENDÊNCIAS.** Preencher domínio Hostinger, URL pública Render e conexão MySQL; executar migrations e validar o fluxo integrado. Nenhum deploy ou alteração de banco foi realizado.

**A `frontend/dist` gerada na auditoria usa um endereço reservado `.invalid` e NÃO deve ser enviada.** Configure a API real e gere novamente. O build normal recusa API ausente, HTTP ou localhost. As variáveis Vite são incorporadas no build; o Apache não lê `.env`.

### Frontend — Hostinger / Apache

- Diretório: `frontend`.
- Instalação: `npm install`; para instalação reproduzível: `npm ci`.
- Build: `npm run build`; saída: `frontend/dist`.
- Caminho público confirmado: **`/tecti/2026/gpec10/`**.
- Vite `base`: `/tecti/2026/gpec10/`, em `frontend/vite.config.js`.
- React Router `basename`: `import.meta.env.BASE_URL`, portanto `/tecti/2026/gpec10/`.
- `frontend/.env.production` é um template sem endereço inventado. Preencha `frontend/.env.production.local` (ignorado pelo Git):

```dotenv
VITE_API_URL=https://<HOST_REAL_DO_RENDER>/api
VITE_GOOGLE_CLIENT_ID=
```

O sufixo `/api` é obrigatório, pois todas as rotas do backend estão montadas nele. O identificador Google é público e opcional; para disponibilizar login Google, use o mesmo Client ID no backend e autorize a origem Hostinger no provedor. Nunca coloque Client Secret, JWT ou credenciais de banco em `VITE_*`.

> Transfira o CONTEÚDO da pasta `dist` para a pasta correspondente ao projeto no servidor Apache.

No FileZilla, abra `frontend/dist` à esquerda e a pasta física correspondente à URL `/tecti/2026/gpec10/` à direita. Confirme a raiz documental na Hostinger: o caminho físico depende da conta e não foi informado. Envie `index.html`, `assets/`, `.htaccess`, `favicon.svg` e `icons.svg`. Ative a exibição de arquivos ocultos para conferir `.htaccess`. Não crie uma pasta `dist` dentro da pasta pública.

Não envie `.env*`, `node_modules`, fontes, backend, `.git`, credenciais ou arquivos de banco. Preserve assets antigos durante a troca do HTML para não quebrar sessões com a versão anterior em cache; remova versões antigas somente depois de verificar a atualização.

O arquivo `frontend/public/.htaccess` é copiado automaticamente para `dist`:

```apache
Options -MultiViews
DirectoryIndex index.html
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /tecti/2026/gpec10/
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>
```

O Apache precisa permitir `.htaccess`/rewrites (`AllowOverride` adequado e `mod_rewrite`). Se retornar 500, consulte o log Apache e confirme permissão para a diretiva `Options`; se rotas internas retornarem 404, confira o módulo e a leitura de `.htaccess`. O preview Vite valida arquivos e fallback local, mas não executa regras Apache.

Se o caminho público mudar, ajuste `base` e `RewriteBase` juntos, atualize `FRONTEND_URL` no backend e gere uma nova build. Não altere os caminhos internos dos `Link` do React Router.

### Backend — Render

Configuração do painel, após você revisar e enviar as mudanças ao GitHub:

```text
Service Type: Web Service
Repository: https://github.com/JAPAnix/domus-TCC
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm ci --include=dev && npx prisma generate
Start Command: npm start
Health Check Path: /health
Auto Deploy: desabilitado inicialmente; habilitar após validar banco, migrations e fluxo integrado
```

`--include=dev` garante a presença da CLI Prisma no build mesmo com `NODE_ENV=production`. Não há etapa de compilação backend nem dependência de nodemon no start. O client gerado é local à plataforma de build: não envie o client gerado no Windows para o Render.

Variáveis obrigatórias no Render (substitua marcadores, não cole literalmente):

```dotenv
NODE_VERSION=24
NODE_ENV=production
FRONTEND_URL=https://<DOMINIO_REAL_HOSTINGER>/tecti/2026/gpec10
JWT_SECRET=<SEGREDO_ALEATORIO_DE_PELO_MENOS_32_CARACTERES>
DATABASE_URL=mysql://<USUARIO_URL_ENCODED>:<SENHA_URL_ENCODED>@<HOST_MYSQL>:<PORTA>/<BANCO>
DATABASE_HOST=<HOST_MYSQL_EXTERNO>
DATABASE_PORT=<PORTA_MYSQL>
DATABASE_USER=<USUARIO_MYSQL>
DATABASE_PASSWORD=<SENHA_MYSQL>
DATABASE_NAME=<BANCO>
DATABASE_SSL=true
```

**Não crie `PORT` manualmente no Render.** O serviço usa a porta fornecida pela plataforma e escuta em `0.0.0.0`; localmente, o padrão é 3000. `start` aceita ausência de `.env` e usa as variáveis do painel. Há encerramento de conexões no SIGTERM.

`FRONTEND_URL` deve conter o endereço completo da aplicação, com a subpasta, para links de recuperação. CORS permite somente `new URL(FRONTEND_URL).origin` em produção: o cabeçalho `Origin` NÃO contém caminhos. Localhost só é permitido fora de produção. CORS não substitui autenticação nem separa aplicações hospedadas em subpastas do mesmo domínio.

`/health` retorna `{"status":"ok"}` sem acessar o banco. Valide também `/api/categories`: HTTP 200 confirma acesso ao banco/schema; após seed, deve retornar categorias. Um health check verde sozinho não confirma MySQL.

Variáveis adicionais para funcionalidades existentes:

```dotenv
# Login Google: mesmo Client ID público usado no frontend.
GOOGLE_CLIENT_ID=
# Recuperação de senha e confirmação de email: preencher todas.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
# Opcional: URL HTTPS pública da marca nos emails.
EMAIL_LOGO_URL=
# Confirmação de telefone em produção:
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
# Opcional: CA PEM exigida pelo provedor MySQL (aceita \n literais).
DATABASE_SSL_CA=
```

Para SMTP em 465, use `SMTP_SECURE=true`; 587 normalmente usa STARTTLS com `false`. **O plano gratuito do Render bloqueia SMTP em 25/465/587; a porta 25 é bloqueada em todos os planos.** Para manter este código SMTP, use um plano e porta permitidos, ou um provedor com porta alternativa permitida e testada. Uma integração por API HTTPS exigiria outra alteração. Não considere recuperação/confirmacão de email pronta sem envio real. SMS console é apenas local, não envia mensagens e é proibido em produção.

Fontes: [Render — Web Services](https://render.com/docs/web-services), [limitações do plano gratuito](https://render.com/docs/free), [versão Node](https://render.com/docs/node-version), [requisitos do Prisma 7](https://www.prisma.io/docs/orm/v7/reference/system-requirements).

### Banco

Biblioteca: Prisma 7 com `@prisma/adapter-mariadb`, datasource `mysql`. Prefira MySQL 8 compatível com as migrations e índices descendentes. São **10 migrations versionadas**; schema e geração do client foram validados. As migrations não foram executadas nesta auditoria. Há criação/alteração de tabelas, reconstrução de índices e atualização de dados de perfis; revise e faça backup antes de aplicá-las a uma base existente.

O runtime usa `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`. A CLI Prisma usa `DATABASE_URL`. **Ambas as configurações devem apontar para a mesma base.** Codifique caracteres especiais de usuário/senha na URL; não codifique a senha na variável separada.

Use TLS para conexão pública: `DATABASE_SSL=true` ativa verificação do certificado no adapter; configure `DATABASE_SSL_CA` se o provedor usar CA própria. Configure também os parâmetros/certificados TLS da `DATABASE_URL` conforme as instruções Prisma/MySQL do provedor: as variáveis SSL do adapter não configuram a CLI automaticamente. Não desative validação de certificados. Libere somente as origens de rede necessárias no firewall do banco (egress do Render e, durante migrations locais, seu IP).

Execução **manual**, em terminal seguro com as variáveis da base de destino e a CLI instalada, dentro de `backend`:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```

O primeiro `migrate status` pode sinalizar migrations pendentes em uma base nova. `migrate deploy` aplica apenas as pendentes. Nenhuma migration está acoplada ao start/build. Se usar o Shell do Render, confirme a disponibilidade no plano; alternativamente execute da máquina local com acesso ao banco e variáveis do destino. Nunca rode os comandos com uma conexão cuja base você não tenha conferido.

Se a base já tiver tabelas sem histórico Prisma compatível, pare e planeje baseline/reconciliação após backup; não rode criação de tabelas cegamente, não marque migrations como aplicadas sem verificar o schema. Não use reset, `db push` ou recriação de banco como rotina de produção.

Existe seed: `npm run db:seed`. Ele cria papéis, atribui papéis a usuários/perfis existentes, insere categorias e itens do catálogo e reativa itens existentes. Execute manualmente depois das migrations, revisando esse comportamento em bases existentes. Não cria contas com senhas padrão. Nenhum seed foi executado nesta tarefa.

## Variáveis locais

Frontend: `frontend/.env.development` já contém `VITE_API_URL=http://localhost:3000/api`. Para Google, crie `frontend/.env.local` com `VITE_GOOGLE_CLIENT_ID`; ele é público. Se precisar substituir a API local, use `.env.development.local` para não contaminar a build de produção.

Backend: copie `backend/.env.example` para `backend/.env` e preencha `DATABASE_URL`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `JWT_SECRET`, `FRONTEND_URL`. Use `NODE_ENV=development`, `PORT=3000`, `DATABASE_SSL=false` apenas para banco local sem TLS e `FRONTEND_URL=http://localhost:5173/tecti/2026/gpec10`. Senha vazia só é tolerada fora de produção. SMTP/Google/Twilio são necessários quando testar essas funcionalidades; `SMS_PROVIDER=console` só simula SMS localmente.

## Segurança e limites da auditoria

- `.env`, `.env.local`, `.env.*.local`, `node_modules` e `dist` são ignorados; os exemplos e templates públicos de desenvolvimento/produção são versionados.
- `frontend/.env` foi removido do índice Git, preservando a cópia local. Continha apenas `VITE_GOOGLE_CLIENT_ID`, um identificador público, não um segredo. A remoção está preparada no índice, sem commit.
- A busca por padrões de credenciais nos commits acessíveis não identificou senha/token privado real. Isso não garante ausência absoluta em arquivos binários ou formatos não reconhecidos. Qualquer credencial real identificada posteriormente deve ser revogada/rotacionada: apagar o arquivo não apaga o histórico.
- Não foi executado ambiente Linux, Apache real nem navegador visual. A inspeção de imports não encontrou diferenças de caixa em imports reais; caminhos ESM do backend usam extensões. A ocorrência apontada pelo scanner no teste de workflow é uma string usada para substituir o import, não um import quebrado.
- Persistem quatro erros de lint anteriores, sem erro novo na configuração de deploy, e aviso de bundle de aproximadamente 535 kB. Não impedem o build e não foram mascarados.
- Pendências preexistentes fora desta preparação: concorrência no consumo do token de recuperação, revogação imediata de JWT, edição restrita a rascunhos embora serviços sejam criados abertos, verificação de identidade preparatória e telas de configurações ainda incompletas. Planeje correção de autenticação antes de abrir para usuários reais.

## Validação realizada

`npm install` passou em ambos os diretórios; build passou com URL HTTPS reservada de auditoria; `dist/index.html` aponta CSS, JS e favicon para `/tecti/2026/gpec10/`; `.htaccess` está na saída. Preview respondeu 200 na inicial, `/login`, `/buscar` e assets referenciados. API iniciou via `npm start`, usou a porta de teste 43107 e respondeu `/health`. Sem banco, `/api/categories` respondeu erro genérico 500 sem credenciais. Teste automatizado valida health e preflight CORS com/sem origem permitida. Prisma validate/generate passaram. Testes: 16 passaram, 1 integração com banco ignorada. Não foram realizadas migrations nem CRUD em banco real.

# INSTRUÇÕES PARA FAZER O DEPLOY

As seções abaixo são por ambiente. A ordem operacional global é: **local → provisionar MySQL → configurar Render e obter URL → aplicar migrations/seed → validar API → build final e upload Hostinger → teste integrado**. O frontend depende da URL do Render; não envie a build de auditoria.

## AMBIENTE 1 — DESENVOLVIMENTO LOCAL

1. Instale Node 24.x compatível. Na raiz, copie o exemplo sem sobrescrever um `.env` existente. No PowerShell:

```powershell
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

2. Preencha as variáveis locais descritas acima. Confirme que o MySQL de desenvolvimento está disponível. Em um terminal:

```bash
cd backend
npm install
npx prisma validate
npx prisma generate
npm test
npx prisma migrate status
```

3. Se a base de desenvolvimento for nova/compatível e você autorizar aplicar migrations e catálogo:

```bash
npx prisma migrate deploy
npm run db:seed
npm start
```

4. Teste `http://localhost:3000/health` e `http://localhost:3000/api/categories`. Em outro terminal, a partir da raiz:

```bash
cd frontend
npm install
npm run dev
```

5. Abra `http://localhost:5173/tecti/2026/gpec10/`, teste login, busca e fluxo de serviço. Frontend, API e MySQL devem funcionar juntos antes de prosseguir. Revise as mudanças e faça commit/push manualmente quando decidir publicá-las; nada foi enviado nesta tarefa.

## AMBIENTE 2 — HOSTINGER / APACHE

1. Execute esta etapa depois de obter e testar a URL pública do Render. Crie `frontend/.env.production.local` com `VITE_API_URL=https://<HOST_REAL_DO_RENDER>/api`; configure o Client ID Google público se usado.
2. Confirme `base` e `basename` `/tecti/2026/gpec10/`, além do `.htaccess` mostrado acima.
3. Dentro de `frontend`:

```bash
npm ci
npm run build
npm run preview
```

4. Abra o endereço de preview informado, incluindo `/tecti/2026/gpec10/`, e confira a API real no Network.
5. Abra a pasta local `frontend/dist` no FileZilla. Envie **seu conteúdo**, inclusive `.htaccess`, à pasta física do servidor que corresponde a `/tecti/2026/gpec10/`. Não envie a pasta `dist` como um nível adicional nem os arquivos privados listados acima.
6. Teste `https://<DOMINIO_REAL_HOSTINGER>/tecti/2026/gpec10/` e `https://<DOMINIO_REAL_HOSTINGER>/tecti/2026/gpec10/login`. Atualize a rota `/login` diretamente no navegador; CSS, imagens e JS devem continuar funcionando. Se alterar `VITE_API_URL`, gere e envie uma nova build.

## AMBIENTE 3 — RENDER

1. Após seu commit/push, crie Web Service usando os campos copiáveis da seção Backend — Render: repositório atual, `main`, raiz `backend`, runtime Node, build `npm ci --include=dev && npx prisma generate`, start `npm start`, health `/health`.
2. Configure todas as variáveis obrigatórias e as integrações que usará. `FRONTEND_URL` aponta à Hostinger com a subpasta; `PORT` não deve ser criado manualmente. Use `NODE_VERSION=24`.
3. Mantenha Auto Deploy desabilitado na primeira implantação. O build gera Prisma Client na plataforma Linux. Não execute migrations no start nem no build.
4. Antes de liberar tráfego de usuários, aplique as migrations manualmente conforme o ambiente 4. A primeira subida pode responder health mesmo antes de existir schema.
5. Teste `https://<HOST_REAL_DO_RENDER>/health` e `/api/categories`. Confira os logs e copie a URL HTTPS real, com `/api`, para a configuração de build frontend. Habilite Auto Deploy apenas quando houver processo definido para migrations compatíveis e validação de cada publicação.

## AMBIENTE 4 — BANCO DE DADOS DE PRODUÇÃO

1. Provisione o banco antes da API: host externo, porta, nome, usuário, senha, política TLS e CA, se necessária. Confirme acesso do Render e faça backup de qualquer base existente.
2. Configure `DATABASE_URL` para a CLI e `DATABASE_HOST/PORT/USER/PASSWORD/NAME` para runtime, todos para o mesmo banco. Ative `DATABASE_SSL=true` e configure CA quando necessário. Ajuste também TLS na URL da CLI conforme o provedor.
3. Em terminal seguro, usando a configuração de produção e dentro de `backend`, execute `npx prisma migrate status`, revise as pendências, execute `npx prisma migrate deploy` e novamente `npx prisma migrate status`. Não exponha valores em comandos compartilhados ou no histórico público.
4. Revise o seed e execute `npm run db:seed` manualmente para disponibilizar papéis e catálogo inicial. Em banco existente, confira reativação de itens e atribuição de papéis.
5. Verifique HTTP 200 e categorias em `/api/categories`; em seguida teste cadastro/login e operações autorizadas na API. A confirmação definitiva da conexão requer banco real e não foi feita nesta auditoria.

## AMBIENTE 5 — TESTE INTEGRADO FINAL

1. Abra a inicial Hostinger e confira CSS, JS, logo e favicon.
2. Abra `/login` e `/buscar` diretamente e atualize cada rota.
3. Confira Network: requisições devem usar o host Render e `/api`, sem localhost, mixed content ou erro de CORS.
4. Cadastre contas de teste de cliente e profissional; teste login com senha e Google, se configurado.
5. Publique perfil profissional com catálogo/disponibilidade, busque-o e crie um serviço como cliente.
6. Envie proposta como profissional, aceite como cliente, confira notificações, conclua o serviço e avalie como cada participante.
7. Edite informações pessoais; confirme email/telefone pelos provedores reais. Teste recuperação de senha e confira se o link inclui `/tecti/2026/gpec10/reset-password`.
8. Leia os registros criados. Teste exclusão somente de registros descartáveis e nos estados permitidos. Edição de serviço atualmente só aceita rascunhos; não confunda essa regra preexistente com erro de infraestrutura.
9. Verifique Console e Network do navegador e logs do Render. Não aceite como validação final apenas o `/health` verde.
