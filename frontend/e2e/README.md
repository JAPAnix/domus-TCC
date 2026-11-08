# Teste de ponta a ponta (QA)

Um comando só, na pasta `frontend/`:

```powershell
npm run test:e2e
```

Ele sobe tudo sozinho, roda e gera `frontend/e2e/report/index.html` (resumo) e `frontend/e2e/report/playwright/index.html` (navegador, com capturas das falhas).

## O que ele faz

1. **Banco descartável.** Usa o MariaDB do XAMPP (`C:\xampp\mysql\bin`) numa porta própria (3307). Recria o banco `dommos_teste`, aplica todas as migrations e carrega o catálogo de categorias. Recusa trabalhar com qualquer banco que não se chame `dommos_teste*`.
2. **Nunca usa o `.env` do projeto.** A API de teste recebe só as variáveis definidas em `e2e/run.mjs`: sem e-mail, sem SMS, sem Cloudinary, pagamento manual ou Asaas **simulado**. Nenhuma chave de produção entra no teste.
3. **Suítes de API** (`e2e/suites/*.mjs`): cada uma roda com uma API nova (zera os limites de requisição). Cobrem conta e sessões, descoberta e favoritos, pedidos e pagamento (direto e Asaas simulado), pedido aberto, mensagens, notificações, admin e segurança.
4. **Navegador** (`e2e/ui/*.spec.mjs`, Playwright com o Edge instalado): as telas principais em 375, 768 e 1280 px, para visitante, cliente, profissional e administrador, mais os fluxos completos. Usa um banco só dele, com o seed `e2e/seed.mjs` (1 administrador, 3 clientes, 3 profissionais, 6 serviços com fotos, avaliação e favoritos, todos com o prefixo `TESTE-`).
5. **Pagamento pela interface com o Asaas simulado** (`e2e/ui/asaas.spec.mjs`): o próprio teste faz o papel do gateway e envia o aviso (webhook) com o token de teste.

## Rodar só uma parte

```powershell
$env:E2E_ONLY='pedido-aberto'   # só as suítes cujo nome contém o trecho ("ui" roda só o navegador)
$env:E2E_SKIP_UI='1'            # pula o navegador
$env:E2E_SKIP_PREP='1'          # não recria o banco (use com o banco já preparado)
npm run test:e2e
```

## O que NÃO é automático (passos manuais, com o Asaas de verdade)

Veja `RELATORIO-TESTE.md`, seção "Passos manuais": confirmar o Pix no painel do sandbox, aprovar a subconta, cartões de teste da documentação do Asaas e o webhook real por túnel.
