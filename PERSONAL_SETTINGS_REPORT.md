# Informações pessoais — relatório de retomada

Data: 15/09/2026. Branch autorizada pelo usuário: **Thales**, também para as próximas etapas.

## Git

- HEAD e origin/Thales: `01620396415543df8e7f80022259da05dc4351fb`.
- main e origin/main: `5103f41be818a22e2482178827906f13cbbd389b`.
- Stories e origin/Stories não existem nas referências obtidas por fetch.
- O commit 0162039 contém a implementação anterior e o documento de passagem.
- A árvore estava limpa antes da retomada. As correções deste relatório estão sem commit e sem stage.
- Nenhum merge, rebase, reset, descarte, troca de branch ou push foi realizado.
- A main tem dois commits exclusivos: fb718f9 (cadastro/painel profissional) e 5103f41 (validação/publicação de serviços).
- Arquivos com mudanças em ambos os lados: backend/prisma/schema.prisma, frontend/src/App.jsx e frontend/src/components/Navbar.jsx. Risco de integração médio, inclusive para rotas e contratos profissionais. Não foi simulado merge.
- Merge histórico compartilhado: 4fc75a2.
- A integração da main não foi necessária para concluir estas correções. A futura integração precisa considerar a migration profissional já presente no banco; não reaplicar ou recriar esse histórico.

## Estado recuperado e resultado

A implementação anterior já continha layout, formulários dedicados, serviços, validações, persistência, verificação de contatos e bloqueio de navegação. Foi reutilizada.

Correções desta retomada:

1. Logout passa por `/sair`; o bloqueador de navegação atua antes de encerrar a sessão. Continuar editando preserva sessão e rascunho; sair sem salvar encerra a sessão.
2. `/bem-vindo` encaminha usuários autenticados para `/configuracoes/pessoais`. O formulário antigo enviava telefone pelo PATCH que agora bloqueia alterações sem confirmação.
3. Removido o ramo antigo de gravação direta de telefone no controller de usuários.
4. Corrigida a mensagem de erro de `/auth/me`.
5. Assunto do email: “Confirme seu novo email no DOMMOS”.
6. Mensagem anterior de sucesso é limpa ao abrir outra edição pelo resumo.
7. Data máxima no frontend usa o mesmo fuso de validação do backend, America/Sao_Paulo. Nascimento continua sendo uma data sem deslocamento de fuso.
8. CEP exibido com hífen, mantendo armazenamento normalizado.
9. Ampliada a suíte de navegador com nascimento, endereços, emergência, email/SMS, logout e tablet/desktop.

## Contrato frontend, API e Prisma

| Campo | Formulário/payload | Resposta API / Prisma | Resultado |
| --- | --- | --- | --- |
| Nome legal | first_name, last_name | firstName, lastName | Mapeamento explícito; obrigatório, trim, até 100 por campo |
| Nome de preferência | preferred_name | preferredName | Opcional; vazio persiste null |
| Email | target, depois code | email, isEmailVerified | Principal muda somente após confirmação |
| Telefone | target, depois code | phoneNumber, isPhoneVerified | Normalizado E.164, confirmação SMS |
| Nascimento | birth_date | birthDate | YYYY-MM-DD na API, DATE no banco; sem futuro |
| CPF | Ausente | Ausente | Não criado |
| Residencial | zip_code e campos de endereço | zipCode e campos correspondentes | CEP normalizado; preenchimento manual |
| Postal | same_as_home, address | postalSameAsHome, postalAddress | Mesmo residencial remove JSON duplicado |
| Emergência | name, relationship, phone | emergencyContact (JSON) | Telefone normalizado; sem SMS |

User permanece sendo o único model de conta. JWT fornece o id autenticado; os novos endpoints não aceitam id de outra conta. `/auth/me` devolve os dados atualizados. Os nomes em snake_case nos payloads seguem o contrato existente e são convertidos explicitamente para os campos Prisma.

## Banco e migrations

Nenhum model ou migration foi alterado nesta retomada. Consulta de leitura confirmou:

- `20260915120000_personal_settings` aplicada; campos de User e ContactVerification disponíveis.
- `20260915160000_professional_onboarding` também aplicada, mas seu arquivo está na main e não neste checkout.
- Tentativas antigas de migrations constam como revertidas e posteriormente aplicadas; nenhum registro de falha não resolvida foi observado na consulta.

Nenhuma migration foi executada, nenhum dado existente foi normalizado ou descartado nesta retomada. Testes criaram contas próprias e as removeram individualmente no cleanup.

## Endpoints e navegação

Endpoints existentes reutilizados, sob `/api`:

- GET `/auth/me` — mensagem de erro corrigida.
- GET `/users/me/personal`.
- PATCH `/users/me/personal/:section` — nome, preferencia, nascimento, residencial, postal, emergencia.
- POST `/users/me/contact/:type/:action` — type: email ou phone; action: solicitar, confirmar ou cancelar. Reenvio usa solicitar.
- PATCH `/users/:uuid` — removido ramo morto de telefone; validação já rejeitava alteração direta de contatos.

Nenhum endpoint de API novo. Rota frontend nova: `/sair`. Rota de configurações preservada: `/configuracoes/pessoais`. Concluir leva a `/servicos` e respeita alterações não salvas.

## Email, SMS e segurança

- Email: Nodemailer com SMTP e HTML DOMMOS. Testado com servidor SMTP local controlado.
- SMS: serviço separado com suporte Twilio; testes usam console exclusivamente em development.
- Código criptograficamente aleatório de seis dígitos, HMAC, validade de dez minutos, cinco tentativas, cooldown de 60 segundos, limites por conta/destino e IP.
- Confirmação, alteração do contato e consumo do código ocorrem em transação com bloqueio da conta.
- Email/telefone antigos permanecem até a confirmação; cancelamento e duplicidade foram testados.
- O modo console é rejeitado em produção.
- CPF, tokens e códigos não foram incluídos neste relatório. Credenciais reais não foram editadas nem exibidas.

## Verificações realizadas neste computador

- Node.js portátil oficial 24.19.0 em `.tmp/node-runtime`, download validado por SHA-256; sem instalação administrativa.
- `npm ci` executado nos dois diretórios, usando lockfiles existentes.
- Prisma validate e generate: aprovados.
- Testes Node: 3 aprovados, incluindo integração real de API e persistência.
- Edge headless + API real: suíte aprovada, nenhuma exceção de runtime e nenhum HTTP 5xx observado.
- Cobertura API: autenticação, autorização, nomes, nascimento, endereços, emergência, contatos válidos/inválidos, código errado/correto/expirado, reenvio/cooldown, limite de tentativas/envios, duplicidade, cancelamento, indisponibilidade de provider e confirmação concorrente.
- Cobertura navegador: dados atuais, nome e refresh, preferência, nascimento, residencial/postal/mesmo endereço, emergência, email/SMS com código incorreto e correto, persistência, voltar, continuar editando, descartar, browser back, sidebar, beforeunload, Concluir, logout com dirty, pós-cadastro e layouts desktop/tablet/mobile.
- Regressão: cadastro/login via API, logout via UI; carregamento de perfil, resumo profissional, formulário profissional, Home, serviços e busca. Não constitui teste completo de publicação/contratação profissional.
- Capturas desktop, tablet e mobile revisadas visualmente; sem transbordamento horizontal nas dimensões testadas (1440, 768 e 390 px).
- Lint dos arquivos de frontend alterados e de configurações: aprovado.
- Lint global: 9 erros preexistentes em AuthContext, CreateReview, CreateService, MyServices, ProfessionalProfile e ServiceProposals.
- Build: aprovado, com aviso de chunk acima de 500 kB.
- `git diff --check`: aprovado.
- npm ci reportou vulnerabilidades nas dependências existentes: backend 9, frontend 10. Não foi aplicado upgrade automático nem audit fix.

Artefatos locais: `.tmp/personal-settings-browser/results.json`, `desktop-personal.png`, `tablet-personal.png`, `mobile-address.png`. A pasta .tmp é ignorada pelo Git.

## Arquivos desta retomada

Criados:

- frontend/src/pages/Logout.jsx
- PERSONAL_SETTINGS_REPORT.md

Alterados:

- backend/src/controllers/authController.js
- backend/src/controllers/userController.js
- backend/src/services/emailService.js
- backend/tests/personal-settings-browser.mjs
- frontend/src/App.jsx
- frontend/src/components/Navbar.jsx
- frontend/src/pages/settings/PersonalEditor.jsx
- frontend/src/pages/settings/PersonalSettings.jsx
- frontend/src/pages/settings/personalFields.js
- PERSONAL_SETTINGS_HANDOFF.md

A lista da implementação original está no commit 0162039. Nenhum arquivo de credenciais ou lockfile foi alterado.

## Configuração externa e limites

IMPLEMENTADO e TESTADO localmente: edição/persistência, confirmação de contatos, proteção de saída e navegação.

PENDENTE DE VALIDAÇÃO EXTERNA:

- Entrega de email em caixa real. Há valores SMTP no ambiente, mas esta sessão usou SMTP local e não confirmou a validade dessas credenciais nem a entregabilidade externa.
- SMS real Twilio. As variáveis de credenciais Twilio estão ausentes neste computador.
- Login Google externo não foi testado.

Variáveis necessárias:

- Banco: DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME; DATABASE_URL para CLI Prisma.
- Autenticação: JWT_SECRET, FRONTEND_URL; GOOGLE_CLIENT_ID quando aplicável.
- Email: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM; EMAIL_LOGO_URL opcional.
- SMS local: NODE_ENV=development e SMS_PROVIDER=console.
- SMS real: SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.
- Frontend: VITE_API_URL; fallback http://localhost:3000/api.

Exemplos já existentes: backend/.env.example e frontend/.env.example. Não comitar segredos. Não executar migrate reset nem tentar recriar a migration profissional ausente.

Para usar o runtime portátil neste computador, na raiz do repositório:

```powershell
$env:PATH = (Join-Path (Get-Location).Path '.tmp\node-runtime\node-v24.19.0-win-x64') + ';' + $env:PATH
npm.cmd run dev --prefix backend
# Em outro terminal, repetir o ajuste de PATH e executar:
npm.cmd run dev --prefix frontend
```