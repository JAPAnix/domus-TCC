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

Requisitos: Node 20 ou superior e um MySQL/MariaDB. Para desenvolvimento local, o MariaDB do XAMPP serve.

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
| `PLATFORM_FEE_PERCENT` | Taxa da plataforma sobre cada serviço. Começa em 0. |
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

### Tempo real (mensagens)

As mensagens usam **WebSocket no próprio servidor** (`/ws`, biblioteca `ws`) e, se ele não estiver disponível, as telas consultam a API a cada poucos segundos. Não há serviço externo. Com mais de uma instância do backend, o estado em memória (presença, "digitando", limite de taxa) precisa ir para um Redis. Alternativas gratuitas avaliadas: Supabase Realtime (plano gratuito com 200 conexões e 100 mensagens por segundo, segundo a documentação) e Firebase; não foram usadas para não criar dependência externa.

## Deploy

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
