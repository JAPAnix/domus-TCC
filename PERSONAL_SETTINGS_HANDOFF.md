# Informações pessoais — ponto de retomada

Trabalho pausado a pedido do usuário em 15/09/2026 para commit e continuação em outro computador.

## Implementado

- `/configuracoes/pessoais`: resumo, edição dedicada de nome, preferência, nascimento, endereço residencial/postal e contato de emergência.
- Email e telefone com código de seis dígitos, HMAC, validade de dez minutos, cinco tentativas, cooldown de um minuto, limites persistentes por conta/destino e limite adicional por IP.
- Confirmação e atualização do contato na mesma transação; contatos atuais preservados até a confirmação; cancelamento de pendências.
- SMTP via Nodemailer; SMS Twilio configurável ou console apenas em `NODE_ENV=development`. Nenhuma dependência nova instalada.
- React Router adaptado para data router; modal de alterações pendentes e beforeunload; Concluir leva a `/servicos`.
- Testes de integração e navegador em `backend/tests/`; auditoria de telefone em `backend/scripts/normalize-phones.mjs`.

## Banco: importante antes de retomar

- A migration `20260915120000_personal_settings` JÁ FOI APLICADA no banco remoto configurado neste computador. Não resetar o banco.
- User recebeu campos opcionais; ContactVerification é novo. CPF não existia e não foi criado.
- Três telefones legados foram normalizados para E.164, sem marcá-los como verificados. Um registro não reconhecido foi preservado, sem exibir seu valor.
- O banco tem uma migration anterior `20260915160000_professional_onboarding` que NÃO existe neste checkout. Não inventar nem sobrescrever esse histórico.
- Contas temporárias criadas pelos testes foram removidas individualmente no cleanup. Usuários existentes não foram usados nos testes.

## Validações já executadas

- Prisma validate e generate: aprovados; migrate deploy: aprovado.
- Build frontend: aprovado, com aviso de bundle acima de 500 kB.
- Lint dos arquivos novos/alterados da implementação: aprovado.
- Lint geral: nove erros preexistentes em AuthContext, CreateReview, CreateService, MyServices, ProfessionalProfile e ServiceProposals.
- Testes de API reais: persistência, SMTP local, SMS console, códigos errados/expirados, reenvio, limite de tentativas/envios, cancelamento, duplicidade, autorização, provider indisponível e confirmação concorrente aprovados.
- Edge headless: carregamento, edição de nome e refresh, descarte/continuação, voltar do navegador, sidebar, beforeunload, mobile, perfil, serviços, busca e logout aprovados. Sem exceções de runtime ou HTTP 5xx nessa rodada.
- NÃO foi testada entrega de email externo nem SMS real Twilio. SMTP foi testado com servidor local controlado; SMS foi testado em console development.

## Pendências para concluir

1. Revisão final do diff, documentação definitiva e relatório dos arquivos/endpoints.
2. Corrigir texto com encoding incorreto na mensagem fallback de `/auth/me` em authController.js (`N?o foi poss?vel...`).
3. Revisar normalização/validação do PATCH legado de usuário: a alteração direta de telefone/email já está bloqueada no validator, mas o controller ainda contém o antigo ramo de telefone (inacessível pela rota validada).
4. Completar testes de interface dos formulários de email/SMS, postal e emergência (os endpoints já foram testados); capturar/revisar desktop além do screenshot mobile.
5. Revisar saída por logout com formulário dirty: Navbar ainda chama logout antes de navegar, podendo contornar o bloqueio. Voltar, Concluir, sidebar e refresh foram testados.
6. Revisar mensagens de sucesso persistentes ao entrar em outro formulário, feedback e limites de validação frontend.
7. Confirmar configuração local de SMS: `.env` real não foi alterado. Usar `NODE_ENV=development` e `SMS_PROVIDER=console` para modo local. Produção exige `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
8. Para email, configurar SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS e EMAIL_FROM; EMAIL_LOGO_URL é opcional. Não comitar segredos.

## Comandos úteis (PowerShell)

Backend, dentro de `backend/`:

```powershell
npm ci
npx prisma generate
npx prisma validate
$env:RUN_DB_TESTS='1'
node --env-file=.env --test tests/personal-settings.test.mjs
node --env-file=.env tests/personal-settings-browser.mjs
```

Os testes de integração usam o banco de `.env`, criam contas temporárias e as removem. A automação de navegador usa Edge no caminho Windows padrão e frontend na porta 5183. Não executar contra um banco diferente sem verificar a configuração.

Frontend, dentro de `frontend/`:

```powershell
npm ci
npm run lint
npm run build
npm run dev
```

`VITE_API_URL` é opcional, com fallback em `http://localhost:3000/api`. O frontend precisa apontar ao backend atualizado.

As alterações de Perfil e estrutura de Configurações feitas anteriormente ainda estão no mesmo working tree. Nenhum commit foi criado pelo agente.
