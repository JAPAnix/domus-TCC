# Dommos

Marketplace de serviços: profissionais publicam anúncios, clientes buscam, conversam, contratam, pagam e se avaliam. Uma conta pode ter os dois papéis ("Vou contratar" e "Vou trabalhar"). Interface em português do Brasil, moeda em reais.

O Dommos roda **sem custo fixo**: o pagamento é combinado direto entre as partes (Pix, dinheiro ou cartão na maquininha) e as mensagens usam o próprio servidor.

## Estrutura

```text
backend/    API Express 5 + Prisma 7 (MariaDB/MySQL), WebSocket das mensagens
frontend/   React 19 + Vite 8 + React Router 7 + Tailwind 4
AUDITORIA.md  o que foi feito, decisões e pendências (leia antes de mexer)
CLAUDE.md     guia técnico e convenções do projeto
```

## Como rodar

Requisitos: Node **24.x, a partir de 24.11.1 e abaixo de 25**, e um MySQL/MariaDB. Para desenvolvimento local, o MariaDB do XAMPP serve.

```powershell
# 1) Backend (API em http://localhost:3000/api)
cd backend
copy .env.example .env          # preencha DATABASE_*, DATABASE_URL e JWT_SECRET
npm ci
npx prisma generate
npx prisma migrate deploy       # confira antes se o banco é o certo
npm run db:seed                 # categorias e serviços do catálogo
npm run dev

# 2) Frontend (http://localhost:5173)
cd frontend
copy .env.example .env          # VITE_API_URL e VITE_GOOGLE_CLIENT_ID (opcional)
npm ci
npm run dev
```

Testes e verificações:

```powershell
cd backend;  npm test            # 53 testes, sem banco
cd frontend; npm test            # regras compartilhadas e conteúdo da ajuda
cd frontend; npm run lint; npm run build
```

> **Cuidado:** `DATABASE_URL` é usada pelas migrations. Nunca rode `migrate` ou testes de integração apontando para um banco com dados reais sem conferir o destino.

## Variáveis de ambiente (backend)

O arquivo `backend/.env.example` lista todas, com comentários. As principais:

| Variável | Para quê |
| --- | --- |
| `DATABASE_HOST/PORT/USER/PASSWORD/NAME` | Conexão do app. Obrigatórias. |
| `DATABASE_URL` | Conexão usada pelo Prisma (migrations). |
| `JWT_SECRET` | Assinatura das sessões. Use um valor longo e aleatório. Obrigatória. |
| `FRONTEND_URL` | Endereço do site (CORS, links de e-mail, origem do WebSocket). |
| `TRUST_PROXY` | `1` quando a API está atrás de proxy (Render, Fly...). Sem isso o limite de taxa vê o IP do proxy. |
| `STORAGE_PROVIDER` | `local` (pasta `backend/uploads`, só desenvolvimento) ou `cloudinary`. |
| `PAYMENT_PROVIDER` | `manual` (padrão) ou `mercadopago`. |
| `SMTP_*`, `EMAIL_FROM`, `SUPPORT_EMAIL` | E-mails (opcionais). Sem SMTP o app funciona, só não envia e-mails. |
| `PLATFORM_FEE_PERCENT` | Taxa da plataforma sobre cada serviço no pagamento direto. Começa em 0. |
| `PAYMENT_PROVIDER`, `ASAAS_*`, `SECRETS_KEY`, `*_FEE*`, `ESCROW_*` | Pagamento pela plataforma. Veja "Ativar o pagamento pela plataforma (Asaas)". |
| `GOOGLE_CLIENT_ID` | Login com Google (opcional). |

No frontend: `VITE_API_URL` (termina em `/api`) e `VITE_GOOGLE_CLIENT_ID`. Nenhum segredo vai para o frontend.

## Como trocar os provedores

### Fotos (storage)

`STORAGE_PROVIDER=local` grava em disco e **não serve para produção em hospedagens com disco temporário** (as fotos somem a cada reinício). Use `cloudinary` e preencha `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`. Para outro serviço, crie um arquivo em `backend/src/services/storage/` com a mesma interface dos provedores existentes e registre-o em `index.js`.

### Pagamento

Todo pagamento passa pela interface `PaymentProvider` (`backend/src/services/payments/`): criar cobrança, consultar status, confirmar, cancelar e estornar. O provedor padrão (`manual`) é gratuito e não depende de ninguém. Para um novo provedor, implemente a interface em um arquivo novo e registre-o em `payments/index.js`; telas e rotas não mudam.

#### Ativar o Pix automático (opcional, Mercado Pago)

O Mercado Pago não cobra mensalidade, mas **cobra uma taxa por transação** (confira a tabela vigente no site deles antes de ativar). O dinheiro cai na conta Mercado Pago da plataforma; o repasse ao profissional é feito por fora.

1. Crie uma conta e uma aplicação em "Suas integrações" no painel de desenvolvedores do Mercado Pago.
2. Copie o **Access Token de teste** (começa com `TEST-`) e use usuários de teste para experimentar.
3. Na aplicação, em **Webhooks**, cadastre a URL `https://SUA-API/api/payments/webhook/mercadopago`, marque o evento **Pagamentos** e copie a **assinatura secreta**.
4. No `.env` do backend:

   ```text
   PAYMENT_PROVIDER=mercadopago
   MP_ACCESS_TOKEN=TEST-...
   MP_WEBHOOK_SECRET=...assinatura secreta...
   PUBLIC_API_URL=https://SUA-API
   ```

5. Reinicie o backend. Se faltar qualquer uma das três variáveis, o sistema volta sozinho ao pagamento direto.
6. Teste o fluxo inteiro com credenciais de teste. Só então troque pelo token de produção (`APP_USR-...`).

O webhook só é aceito com assinatura válida e o sistema consulta o pagamento no provedor antes de confirmar. A integração foi testada contra um servidor simulado, **não contra o Mercado Pago real**.

#### Ativar o pagamento pela plataforma (Asaas)

Modelo parecido com o do Airbnb: o cliente paga **pelo Dommos** (Pix, cartão de crédito ou boleto), o valor é dividido automaticamente (*split*) entre o profissional e a comissão da plataforma, e o repasse acontece depois que o cliente confirma o serviço. Nada passa por conta pessoal. **A troca é uma única variável: `PAYMENT_PROVIDER=asaas`** (com as chaves abaixo preenchidas; se faltar alguma, o sistema volta sozinho ao pagamento direto).

**O que o Asaas exige:** subcontas e split só existem em conta **PJ (CNPJ)**. Em CPF, só dá para testar no sandbox. As taxas mudam por contrato; confira as do seu antes de definir a comissão.

Passo a passo:

1. **Sandbox (testes):** crie uma conta em https://sandbox.asaas.com, gere a chave de API (Integrações) e habilite o **Split**.
2. No `.env` do backend:

   ```text
   PAYMENT_PROVIDER=asaas
   ASAAS_ENV=sandbox
   ASAAS_API_KEY=...chave do sandbox...
   ASAAS_WEBHOOK_TOKEN=...invente um texto de 32 a 255 caracteres...
   SECRETS_KEY=...gere com: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   PUBLIC_API_URL=https://SUA-API
   ```

   `SECRETS_KEY` cifra, no banco, a chave de API de cada profissional. **Guarde uma cópia: se ela se perder, as chaves já gravadas não podem ser lidas.**
3. **Webhook** (Integrações > Webhooks): URL `https://SUA-API/api/payments/webhook/asaas`, o **mesmo token** de `ASAAS_WEBHOOK_TOKEN`, fila ativa, e marque os eventos de **cobrança** (`PAYMENT_*`) e de **status da conta** (`ACCOUNT_STATUS_*`). O Asaas pausa a fila depois de 15 falhas seguidas; o painel de administração mostra os eventos com erro.
4. **Migration** (uma vez por banco): `npx prisma migrate deploy` aplica `20261109100000_asaas_payments`. Confira antes com `npx prisma migrate status` e **faça backup antes de rodar no banco de produção**.
5. **Administrador** (painel de reclamações): `node --env-file=.env scripts/grant-admin.mjs seu@email.com`. O painel fica em `/admin/pagamentos`.
6. Reinicie o backend. Em Configurações > Pagamentos > "Como recebo", o profissional cadastra a conta de recebimento; a análise do Asaas leva algum tempo (no sandbox, aprove pelo painel do sandbox).
7. **Produção:** abra a conta Asaas PJ, envie os documentos da empresa, aguarde a aprovação, troque `ASAAS_ENV=production` e a `ASAAS_API_KEY`, e recadastre o webhook na conta de produção. Teste um Pix de valor baixo antes de divulgar.

**Taxas e prazos** (todos opcionais): `CLIENT_FEE_PERCENT` (taxa de serviço cobrada do cliente, padrão 0), `PRO_COMMISSION_PERCENT` (comissão descontada do profissional, padrão 10), `GATEWAY_FEE_PAYER` (`professional` ou `platform`, padrão `professional`), `AUTO_CONFIRM_DAYS` (confirmação automática do serviço, padrão 7). As taxas ficam gravadas em cada pagamento; mudar a configuração depois não altera pedidos já pagos. Valores em centavos inteiros, arredondamento "meio para cima".

**Prazos de repasse:** Pix, na hora (depois da confirmação do serviço); **cartão, 32 dias corridos** depois do pagamento (parcelado: uma parcela a cada 32 dias); boleto, depois da compensação. Não há antecipação paga. Isso aparece ao profissional em "Como recebo" e nos Termos de uso.

**Conta Escrow (garantia): `ESCROW_ENABLED=false` por padrão.** Com ela, o Asaas segura o valor na subconta do profissional até a plataforma encerrar a garantia (quando o cliente confirma) ou até `ESCROW_DAYS` (padrão 14, precisa ser maior que `AUTO_CONFIRM_DAYS`). A documentação pública não informa se há **mensalidade por subconta**. Antes de ligar, confirme com o Asaas: (a) se a Conta Escrow está liberada para a sua conta, (b) o custo por subconta, (c) quem consulta e quem encerra a garantia (hoje o código lê com a chave da subconta e encerra com a chave da plataforma) e (d) se o split funciona junto com a garantia. Com a flag desligada, a proteção do cliente é o fluxo de **reclamação e estorno**: o dinheiro é dividido no pagamento, a reclamação é aberta antes de o cliente confirmar o serviço e um administrador decide entre liberar e estornar. O Asaas não devolve a própria taxa em reembolsos.

**Cancelamento e reembolso:** seguem a política do anúncio (flexível 24 h, moderada 72 h, rígida 7 dias para reembolso integral; fora do prazo, 50%, 50% e 0%; cancelamento feito pelo profissional é sempre integral).

**O que foi e o que não foi testado:** o fluxo completo (cadastro da conta, Pix, cartão e boleto, webhook com idempotência, conciliação, liberação, reclamação, estorno por política, CSV) foi validado contra um **servidor Asaas simulado**, com banco real descartável. **Nada foi testado contra o Asaas real.** Confirme no sandbox, na primeira vez: a atualização do split (`PUT /v3/lean/payments/{id}`), o encerramento da garantia, quem arca com a taxa do gateway quando há split e a liquidação do boleto. Segurança: o webhook só aceita o token correto (comparação em tempo constante), eventos repetidos são ignorados pelo id, dados de cartão nunca passam pelo servidor (o cliente paga na página segura do Asaas), os logs não guardam segredos e só as duas partes do pedido (e administradores) veem o pagamento.

### E-mail (recuperação de senha, códigos e avisos)

Há duas formas, e `EMAIL_FROM` (por exemplo `Dommos <seu@gmail.com>`) é obrigatório nas duas:

- **Brevo por API HTTPS (recomendado no Render):** o plano gratuito do Render **bloqueia as portas SMTP** (25, 465 e 587), então o Gmail SMTP não funciona lá. A Brevo é gratuita (300 e-mails por dia) e não exige domínio próprio. Crie a conta em https://www.brevo.com, vá em **Remetentes e IPs > Remetentes** e adicione o seu e-mail como remetente (a Brevo manda um link de confirmação). Em **SMTP e API > Chaves de API**, gere uma chave (começa com `xkeysib-`). No Render, defina `BREVO_API_KEY` e `EMAIL_FROM` com **o mesmo e-mail** do remetente confirmado.
- **SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`. Serve para desenvolvimento local ou hospedagens que liberam SMTP. Com `BREVO_API_KEY` definida, ela tem prioridade.

Sem nenhuma das duas, o app funciona, mas não envia e-mails.

**Brevo e IPs autorizados:** se a conta da Brevo tiver o bloqueio por IP ligado (Segurança > IPs autorizados), a API recusa as chamadas do Render com "unrecognised IP address", porque o IP dele muda. Desative esse bloqueio em https://app.brevo.com/security/authorised_ips. Para conferir a configuração sem mostrar nenhuma chave: `node --env-file=.env scripts/check-email.mjs --send seu-email@exemplo.com`.

**"Esqueci minha senha":** o link vale 30 minutos, só pode ser usado uma vez e, ao redefinir, todas as sessões da pessoa são encerradas e ela recebe um e-mail avisando da troca. A resposta do site é sempre a mesma, exista ou não conta com aquele e-mail. Quem criou a conta só com o Google recebe um e-mail explicando isso e pode criar uma senha pelo mesmo link. Em desenvolvimento, sem provedor de e-mail configurado, o link aparece no terminal do backend (`[DEV] Link de redefinição de senha ...`); em produção nunca.

### Pedido aberto e Oportunidades

Existem dois tipos de pedido: o **pedido por anúncio** (o cliente escolhe um serviço de um profissional; ele aparece em "Pedidos recebidos", no painel) e o **pedido aberto** (o cliente descreve o que precisa em "Publicar um pedido" e os profissionais enviam propostas; eles os veem em "Oportunidades"). Depois do aceite, os dois seguem o mesmo fluxo de pagamento, execução e avaliação (o pedido interno guarda a origem em `orders.origin`).

Variáveis (todas opcionais, em `backend/.env.example`): `OPEN_REQUESTS_ENABLED` (`false` desliga tudo), `OPEN_REQUEST_MAX_PROPOSALS` (5), `OPEN_REQUEST_DEFAULT_DAYS` (7), `OPEN_REQUEST_MAX_PER_DAY` (5), `OPEN_REQUEST_MAX_ACTIVE` (10), `OPEN_REQUEST_DIGEST_HOURS` (6) e `OPEN_REQUEST_PROPOSAL_VALIDITY_HOURS` (72). A rotina que expira pedidos e propostas e envia o resumo de oportunidades roda sozinha a cada 10 minutos dentro do servidor.

**Conferir as migrations em produção:** abra `https://SUA-API/health`. O campo `database` mostra `ok` ou `migrations-pendentes` (com a lista em `pendingMigrations`). Se houver pendentes: faça backup, rode `npx prisma migrate deploy` na pasta `backend` e confira de novo. Telas do administrador com "Não foi possível concluir a ação" quase sempre significam migration pendente.

### Tempo real (mensagens)

As mensagens usam **WebSocket no próprio servidor** (`/ws`, biblioteca `ws`) e, se ele não estiver disponível, as telas consultam a API a cada poucos segundos. Não há serviço externo. Com mais de uma instância do backend, o estado em memória (presença, "digitando", limite de taxa) precisa ir para um Redis. Alternativas gratuitas avaliadas: Supabase Realtime (plano gratuito com 200 conexões e 100 mensagens por segundo, segundo a documentação) e Firebase; não foram usadas para não criar dependência externa.

## Deploy (visão geral e alternativas gratuitas)

1. **Banco:** um MySQL/MariaDB acessível pela internet. Aplique as migrations com `npx prisma migrate deploy` e rode `npm run db:seed` uma vez.
2. **Backend:** `npm ci && npx prisma generate && npm start` (Node 20+). Defina as variáveis acima, `NODE_ENV=production`, `TRUST_PROXY=1` e `STORAGE_PROVIDER=cloudinary`. O servidor precisa aceitar WebSocket (a maioria aceita).
3. **Frontend:** `npm ci && npm run build` com `VITE_API_URL` apontando para a API; publique a pasta `dist/` em qualquer hospedagem estática. Configure o redirecionamento de todas as rotas para `index.html` (o arquivo `frontend/public/_redirects` já faz isso em Netlify e Cloudflare Pages).
4. Defina `FRONTEND_URL` no backend com o endereço final do site.

### Hospedagem gratuita sugerida

- **Backend:** Render, serviço web gratuito. Compatível com Node e WebSocket. Limites confirmados na documentação deles: o serviço **dorme após 15 minutos sem tráfego** (a primeira visita seguinte leva cerca de 1 minuto) e o **disco é apagado a cada reinício**, por isso `cloudinary` é obrigatório para fotos. Mensagens WebSocket recebidas contam como atividade.
- **Frontend:** Cloudflare Pages, Netlify ou Vercel (planos gratuitos para sites estáticos). Confira os limites atuais no site de cada um.
- **Banco:** não consegui confirmar um plano gratuito de MySQL com condições estáveis (os planos mudam com frequência e o PlanetScale encerrou o gratuito). Avalie TiDB Cloud (compatível com MySQL) e Aiven, **verificando os limites vigentes**, ou use um MariaDB próprio. O Prisma está configurado com o adaptador MariaDB.

## Segurança em resumo

Senhas com bcrypt; sessões JWT conferidas no banco (dá para encerrar à distância); limite de taxa em login, cadastro, recuperação de senha, mensagens, pagamentos e denúncias; validação com Zod em todas as rotas; fotos validadas pelo conteúdo do arquivo; HTML digitado em mensagens é sempre exibido como texto; cabeçalhos de segurança na API; nenhum dado de cartão é recebido ou guardado. O token fica no `localStorage`, então qualquer falha de XSS no site expõe a sessão: mantenha as dependências atualizadas e não use `dangerouslySetInnerHTML`.

---

## Deploy do projeto: Hostinger (frontend) e Render (backend)

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
