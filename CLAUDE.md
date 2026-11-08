# CLAUDE.md

Guia para quem trabalha neste repositório. A stack e as convenções vêm da leitura do código em 05/11/2026. Se o código mudar, atualize este arquivo.

## Contexto do produto

É um marketplace de **serviços** inspirado na UX do Airbnb. No lugar de casas/acomodações, o catálogo é de serviços oferecidos por **profissionais**. Há dois papéis na mesma conta:

- **"Vou contratar" (cliente):** busca, favorita, conversa, contrata, paga, avalia.
- **"Vou trabalhar" (profissional):** cria anúncios de serviço, recebe pedidos, conversa, recebe pagamento.

O idioma da interface é português do Brasil e a moeda é só Real (BRL) por enquanto.

O sistema está quase pronto. O trabalho é **revisar, corrigir, organizar e terminar**, não reescrever do zero.

## Regras de trabalho

- Use o Airbnb apenas como referência de UX (fluxos, organização, estados vazios). Não copie logo, nome, ilustrações, textos ou assets. O visual final deve ter identidade própria.
- Priorize soluções gratuitas, sem mensalidade e sem cartão de crédito.
- Antes de apagar qualquer página ou rota, confirme que nada mais a referencia. Liste o que apagou no relatório.
- Toda tela precisa ter estado de carregando, vazio e erro, além de responsividade (mobile primeiro) e acessibilidade básica (foco visível, labels, contraste AA).
- Nenhum botão ou link pode levar a lugar nenhum ou a uma página errada. Se a funcionalidade não existe, implemente ou remova o botão.
- Depois de cada bloco de trabalho, rode o build e o lint e corrija os erros antes de seguir.
- Ao terminar cada prompt, atualize o `AUDITORIA.md` com o que foi feito e o que ficou pendente. O arquivo ainda não existe; crie-o na primeira atualização.

## Stack

Monorepo sem workspaces: `frontend/` e `backend/` têm cada um seu `package.json` e seu `node_modules`. Todo o código é JavaScript com ES Modules, sem TypeScript. Não há `engines` nem `.nvmrc` fixando a versão do Node.

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7 (data router), Tailwind CSS 4 (`@tailwindcss/vite`), React Compiler, axios |
| Backend | Node, Express 5, Zod 4, Nodemon |
| Banco | MySQL/MariaDB via Prisma 7 com `@prisma/adapter-mariadb` |
| Autenticação | JWT Bearer (1 dia) guardado no `localStorage`, senha com bcryptjs, login Google (`google-auth-library`) |
| E-mail | SMTP via Nodemailer (opcional) |
| Pagamentos | Interface `PaymentProvider`: pagamento direto (padrão, gratuito) ou Mercado Pago (opcional) |
| Tempo real | WebSocket (`ws`) no próprio Express, com consulta periódica como reserva |
| SMS | Twilio via `fetch`, ou console em desenvolvimento (`SMS_PROVIDER=console` com `NODE_ENV=development`) |
| Storage | Upload de fotos via `POST /api/uploads` (multer em memória), com provedor trocável por `STORAGE_PROVIDER`: `local` (pasta `backend/uploads`, só desenvolvimento) ou `cloudinary` (produção, ainda sem teste contra conta real). O banco guarda só a URL |
| Deploy | Guia no [README.md](README.md). CORS usa `localhost:5173`, `127.0.0.1:5173` e `FRONTEND_URL`; porta por `PORT` (padrão 3000) |

### Como rodar

Copie `backend/.env.example` para `backend/.env` e `frontend/.env.example` para `frontend/.env`, depois preencha os valores. O backend encerra na inicialização se faltar `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` ou `JWT_SECRET`.

O app usa as variáveis `DATABASE_*`, mas a CLI do Prisma lê `DATABASE_URL` em `backend/prisma.config.ts`. Essa variável não está no `.env.example`, então adicione-a ao `.env` para rodar migrations.

```powershell
# Backend, em backend/ (API em http://localhost:3000/api)
npm ci
npx prisma generate        # gera o client em backend/generated/prisma (fora do git)
npx prisma migrate deploy
npm run db:seed            # catálogo de categorias e serviços
npm run dev

# Frontend, em frontend/ (http://localhost:5173)
npm ci
npm run dev
```

**Cuidado com o banco:** `PERSONAL_SETTINGS_HANDOFF.md` indica que o `.env` local aponta para um banco remoto com dados reais. Confira o destino antes de rodar migrations ou testes de integração e não resete o banco.

### Build, lint e testes

| Onde | Comando | Observação |
| --- | --- | --- |
| `frontend/` | `npm run build` | Gera `dist/` |
| `frontend/` | `npm run lint` | ESLint |
| `backend/` | `npm test` | Testes unitários (16): fluxo de serviço, publicação e upload. Não usam banco |
| `backend/` | `$env:RUN_DB_TESTS='1'; node --env-file=.env --test tests/personal-settings.test.mjs` | Usa o banco real do `.env`; cria e remove contas temporárias |
| `backend/` | `node --env-file=.env tests/personal-settings-browser.mjs` | Automação com Edge; frontend na porta 5183. **Desatualizado** desde a nova navegação (procura textos e botões antigos); revisar antes de usar |

O backend não tem build nem lint. O frontend não tem testes automatizados.

**Para testar com banco descartável** (sem tocar no banco remoto): o XAMPP traz um MariaDB em `C:\xampp\mysql\bin`. Crie um diretório de dados com `mysql_install_db.exe`, suba o `mysqld.exe` em outra porta, aponte `DATABASE_*` e `DATABASE_URL` para ele, rode `npx prisma migrate deploy` e `npm run db:seed`. Em máquinas com pouca memória, use `NODE_OPTIONS=--max-old-space-size=...` e prefira servir o build estático em vez do `vite` em modo de desenvolvimento.

## Estrutura

```text
backend/
  prisma/       schema, migrations, seed
  scripts/      scripts avulsos de manutenção de dados
  src/
    app.js      entrada do Express
    routes/     rotas por recurso, reunidas em routes/index.js
    controllers/ handlers HTTP
    services/   regras de negócio e integrações (serviceWorkflow, e-mail, SMS); storage/ guarda os provedores de foto
    middleware/ auth, papéis, validação, rate limit, erros
    validators/ schemas Zod
    utils/      logger, uuid, normalização de dados
  tests/
frontend/src/
  App.jsx       todas as rotas
  pages/        uma página por rota; settings/ e profile/ agrupam subpáginas
  components/   componentes compartilhados; ui/ tem os componentes base (importe de './ui')
  context/      AuthContext (hook em useAuth.js) e ModeContext (modo cliente/profissional, useMode.js)
  hooks/        useApiResource (GET com carregando/erro), useCategories, useUnreadNotifications
  services/     api.js (axios com token; apiError e apiFieldErrors para mensagens)
  utils/        format.js (moeda, datas), image.js (validação e compressão), status.js
```

## Domínio atual

- **Papéis:** `client` (recebido no cadastro) e `professional` (adicionado ao criar o perfil profissional), em `roles` e `user_roles`.
- **Fluxo implementado:** o cliente publica um `Service` (um pedido) → profissionais enviam `Proposal` → o cliente aceita uma, as demais pendentes são rejeitadas e o serviço fica `in_progress` → o cliente conclui → as duas partes se avaliam (`Review`).
- **Oferta do profissional:** `Listing` publicado (anúncio) e contratado por `Order`; o fluxo de pedido aberto e propostas continua em paralelo.
- **Status do serviço:** `draft`, `open`, `in_progress`, `completed`, `cancelled`. As transições ficam em `backend/src/services/serviceWorkflow.js`.
- **Perfil profissional:** `ProfessionalProfile` (nota, selo, itens de `ServiceCatalogItem`) sustenta os anúncios; a oferta é encontrada em `/buscar` pelos `Listing`.

## Convenções observadas

**API e banco**

- Rotas da API em inglês, sob `/api`. Corpo das requisições em `snake_case`; respostas em geral em `camelCase`.
- Erros no formato `{ message }`, com `errors: [{ field, message }]` em falhas de validação. Mensagens em português.
- Validação com Zod em `validators/`, aplicada pelo middleware `validate(schema)`.
- Rotas protegidas usam `authMiddleware` e, quando preciso, `roleMiddleware('client' | 'professional')`.
- IDs públicos são UUID em `BINARY(16)` (converta com `utils/uuid.js`); IDs internos são `BigInt`.
- Exclusão lógica com `deletedAt` em `User` e `Service`.
- Models em PascalCase e campos em camelCase no Prisma, mapeados para `snake_case` com `@map`/`@@map`.
- Mudanças no schema sempre por migration nomeada em `prisma/migrations`.
- Fluxos com concorrência usam transação com `SELECT ... FOR UPDATE`. Notificações têm `eventKey` único para não duplicar.

**Frontend**

- Rotas de tela em português (`/servicos`, `/meus-servicos`, `/configuracoes`). Exceções atuais: `/forgot-password` e `/reset-password`.
- Páginas e componentes em PascalCase `.jsx`, como funções com `export default`. Helpers de seção em camelCase `.js`.
- Dados carregados com `useApiResource` (ou `api` direto em ações). Não há biblioteca de cache nem de formulários.
- **Estilo só por tokens**, definidos em `src/index.css`: `bg-primary`, `text-ink-muted`, `border-line`, `rounded-control`, `shadow-card` etc. A paleta padrão do Tailwind está desativada, então `bg-violet-600` ou `#7C3AED` não funcionam e não devem ser usados. A paleta e os contrastes estão descritos no `AUDITORIA.md`.
- Use `Button`, `Input`/`Select`/`Textarea`, `Card`, `Modal`/`ConfirmDialog`, `Toast` (`useToast`), `Avatar`, `SkeletonList`, `EmptyState`/`ErrorState` e `Breadcrumb` de `components/ui`. Não crie versões locais.
- Toda imagem enviada pelo usuário usa `ImageUploader`. Toda tela de dados tem carregando, vazio e erro.
- Os modos "Vou contratar" (`client`) e "Vou trabalhar" (`professional`) vêm de `useMode()`; sem perfil profissional a conta fica sempre em `client`.
- Textos da interface em português do Brasil, com o nome **Dommos**. Pedidos de clientes se chamam "pedidos"; o profissional envia "propostas".
- Aspas simples e duplas convivem; siga o estilo do arquivo que estiver editando.

## Arquitetura da área do usuário e do profissional (Fases 1 e 2)

- **Sessões:** o JWT leva `sid` e o `authMiddleware` confere `user_sessions` no banco; tokens antigos sem `sid` são recusados.
- **Anúncios e contratações:** `Listing` (rascunho, publicado, pausado) e `Order` (requested, proposed, accepted, in_progress, completed, declined, cancelled, expired; pedido "sob consulta" passa por proposta e vence por `services/orderExpiry.js`). Regras puras em `backend/src/utils/listingRules.js` (cópia idêntica em `frontend/src/utils/listingRules.js`, conferida por teste) e `orderRules.js`; fluxo em `services/orderWorkflow.js`.
- **Rotas novas:** `/api/listings` (busca e vitrine públicas), `/api/pro` (área do profissional), `/api/orders`, `/api/account`, `/api/settings`, `/api/blocks`, `/api/profile`, `/api/favorites`, `/api/help`.
- **Telas:** `/pro/*` (Painel, Pedidos, Serviços, Ganhos; passo a passo em `pages/pro/wizard/`), `/anuncios/:uuid`, `/buscar`, `/contratacoes/:uuid`, `/pagamentos/:uuid/recibo`, `/mensagens[/:uuid]`, `/mensagens/respostas-rapidas`, `/configuracoes/*`, `/ajuda/*` (conteúdo em `src/content/`). As páginas são carregadas sob demanda (`lazy` em `App.jsx`); título e descrição vêm de `RouteTitle` e `useDocumentMeta`.
- **Pagamentos:** interface `PaymentProvider` em `backend/src/services/payments/`. Padrão `manual` (Pix com BR Code gerado em `utils/pixBrCode.js`, dinheiro, cartão presencial; sem custo). `asaas` (pagamento pela plataforma com split: Pix, cartão e boleto; `PAYMENT_PROVIDER=asaas` mais `ASAAS_*` e `SECRETS_KEY`; fluxo em `services/asaasPayments.js`, webhook em `asaasWebhook.js`, conta de recebimento em `payoutAccounts.js`, centavos em `utils/money.js`, taxas em `config/fees.js`; Conta Escrow atrás de `ESCROW_ENABLED`, desligada; painel em `/admin/pagamentos`, papel `admin` via `scripts/grant-admin.mjs`; guia no README; nunca testado contra o Asaas real). `mercadopago` é opcional, desligado por padrão e só liga com `PAYMENT_PROVIDER`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e `PUBLIC_API_URL`. Fluxo e regras em `services/paymentWorkflow.js` e `utils/paymentRules.js`. Nunca guardar dados de cartão. A chave Pix do profissional fica em `user_settings.payout_key` e se edita só em Configurações > Pagamentos.
- **Mensagens:** conversa 1 a 1 ligada a um anúncio (`Conversation`, `Message`), serviço em `services/messageService.js`. Tempo real por WebSocket no próprio servidor (`services/realtime.js`, rota `/ws`, autenticação na primeira mensagem) com consulta periódica à API como reserva (`frontend/src/services/realtime.js`). Respostas rápidas têm envio programado (agendador de 1 minuto, iniciado em `app.js`). Texto é sempre exibido como texto puro.
- **Página do serviço e contratação:** `ListingView` monta a página (peças em `components/listing/`: galeria, calendário, avaliações, mapa, carrosséis, denúncia). Horário (por hora) e intervalo de datas (por diária) vivem em `utils/bookingSlots.js`, **idêntico no backend e no frontend** (um teste confere). O servidor serializa os pedidos do mesmo anúncio e recusa conflitos (409), inclusive ao aceitar. O fluxo em etapas é `pages/RequestFlow.jsx` (`/anuncios/:uuid/solicitar`). Critérios dos selos de destaque: só em `backend/src/utils/highlightRules.js`. Avaliações e resposta do profissional em `services/listingPageService.js`. Não existe "contratação imediata": todo pedido precisa ser aceito.
- **Identidade visual:** cores só por tokens em `src/index.css` (escalas `primary-50..900`, `secondary-*`, `accent-*`, cores de categoria `cat-*-solid|soft|ink`, degradês `bg-gradient-*`). A cor de cada categoria vem de `utils/categoryColors.js`. Texto branco só sobre as pontas escuras dos degradês; confira o contraste (AA) ao criar um par novo. `/styleguide` mostra tudo e só existe em desenvolvimento. A Landing é só para visitantes: quem está logado é redirecionado.
- **Verificação de profissional:** análise manual por `node scripts/review-verification.mjs list|approve|reject`, em `backend/`.
- **Testes:** `npm test` no backend roda 140 testes sem banco (regras de pedidos, anúncios, pagamentos, mensagens, BR Code, assinatura de webhook, uploads). `npm test` no frontend roda 20. Para fluxos completos use um MariaDB descartável (ver acima), nunca o banco remoto; os testes de API e de navegador usados nas rodadas 2 e 3 não estão no repositório.
- **Segurança:** limite de taxa em `middleware/rateLimit.js` (em memória, uma instância); defina `TRUST_PROXY=1` atrás de proxy. Rotas antigas de `/users/:uuid` e `/professionals/*` foram removidas; só `GET /professionals/dashboard` permanece.

## Lacunas conhecidas

A lista completa está no [AUDITORIA.md](AUDITORIA.md). Resumo (06/11/2026):

- **Não existem** push nem WhatsApp, painel de administração (verificação, denúncias, feedbacks e chamados ficam só no banco) e anexos que não sejam foto.
- Pagamento é combinado direto entre as partes; o Mercado Pago opcional nunca foi testado contra o serviço real e cobra taxa por transação.
- As migrations `20261105120000`, `20261106100000`, `20261106200000`, `20261107100000`, `20261107200000` e `20261108100000`, `20261113100000` e `20261114100000` precisam ser aplicadas no banco real (confira `prisma migrate status` antes). Depois disso todos precisam entrar de novo.
- CPF, CNPJ e chave Pix ficam sem criptografia em repouso.
- Cloudinary, SMTP e login Google nunca foram testados com credenciais reais.
- Metadados de compartilhamento (WhatsApp, Facebook) não aparecem sem renderização no servidor; sem `sitemap.xml` nem `robots.txt`.
- O Twilio (SMS) é pago, o que conflita com a regra de priorizar soluções gratuitas.
- Os relatórios antigos na raiz (`RELATORIO_*.md`, `PERSONAL_SETTINGS_*.md`) e `backend/tests/personal-settings-browser.mjs` estão desatualizados.
