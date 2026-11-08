# Relatório de teste de ponta a ponta (QA)

Data: 08/11/2026 · Ambiente: **somente desenvolvimento** (banco MariaDB descartável `dommos_teste`, API local, Asaas **simulado**; nada de e-mail, SMS ou Cloudinary reais; nenhuma chave de produção; o `.env` do projeto nunca é lido pelo teste).

Como rodar tudo de novo: `npm run test:e2e` na pasta `frontend` (veja `frontend/e2e/README.md`). O relatório de cada rodada fica em `frontend/e2e/report/index.html`.

## Resumo

- **Backend** `npm test`: 165 testes, 161 passam e 4 são pulados (3 de fumaça do admin, que precisam de uma API ligada, e 1 que usa o banco real). **Frontend**: lint limpo e 26 testes passam; o build funciona.
- **Suítes de API** (contra API e banco reais de teste): 21 suítes de API e 8 arquivos de navegador: **1273 verificações, 0 falhas** na rodada final (`npm run test:e2e`).
- **Navegador** (Playwright, Edge): 8 arquivos, cada cenário em **375, 768 e 1280 px**; mais o pagamento pelo Asaas simulado em 375 e 1280 px.
- **Bugs de produto achados e corrigidos:** 1 (texto digitado durante um envio lento de mensagem era apagado). O restante das falhas encontradas pelo caminho eram testes desatualizados ou com suposição errada (listados abaixo).

## Tabela de cenários

Legenda: **passou** = automatizado e verde nesta rodada · **corrigido** = achou defeito, corrigido, com teste de regressão · **manual** = precisa do Asaas/Google de verdade (passos abaixo) · **não testado** = sem como testar aqui.

| Nº | Cenário | Resultado | Evidência | Observação |
| --- | --- | --- | --- | --- |
| 1 | Cadastro: validações e mensagens claras | passou | `auth-extra` (39), `conta.spec` | e-mail repetido, senha curta/fraca, nome com HTML |
| 2 | Login, logout, sessão expirada, rota protegida | passou | `auth-extra`, `conta-sessoes` (131), `conta.spec`, `responsivo.spec` | token adulterado e "alg none" recusados; limite de tentativas (429) |
| 3 | Esqueci minha senha: link, redefinir, vencido e reutilizado | passou | `auth-extra`, `conta.spec` | link lido do log de teste (nenhum e-mail real); e-mail inexistente responde igual |
| 4 | Login com Google | não testado | — | `[GSI_LOGGER]`: o cliente OAuth só vale nos domínios autorizados; sem credencial de desenvolvimento |
| 5 | Perfil: editar nome/foto, arquivo inválido/grande, configurações, idioma/moeda | passou | `conta.spec`, `uploads` (26) | só português e real; sem termos de hospedagem |
| 6 | Home, busca, filtros, categorias, ordenação, estados vazios | passou | `catalogo-favoritos` (34), `descoberta.spec` | busca com SQL injection não vaza |
| 7 | Favoritar/desfavoritar, lista, persistência ao recarregar | passou | `catalogo-favoritos`, `descoberta.spec` | outra conta não vê nem altera a lista |
| 8 | Página do serviço: galeria, calendário, avaliações, profissional, cartão de contratação, responsivo | passou | `pagina-servico-reserva` (52), `descoberta.spec` | sem e-mail/telefone do profissional |
| 9 | Contratar serviço, escolher data, revisar resumo | passou | `pedido-anuncio.spec`, `endereco-pedido`, `pedido-anuncio-proposta` (48) | passo a passo pela interface |
| 10 | Pix: QR e copia e cola, confirmação, tela atualiza sozinha | passou (simulado) | `asaas.spec`, `pagamento-asaas` (126) | confirmação real no sandbox é **manual** (passo 3) |
| 11 | Cartão aprovado e recusado (mensagem clara, tentar de novo) | passou (simulado) | `asaas.spec`, `pagamento-asaas` | o Dommos nunca pede dados de cartão |
| 12 | Boleto: gerar e confirmar | passou (simulado) | `asaas.spec` | compensação real no sandbox é **manual** |
| 13 | Webhook repetido, token errado, fora de ordem | passou | `webhooks-ordem` (16), `pagamento-asaas`, `seguranca-extra` | estado nunca anda para trás; nunca 500 |
| 14 | Comissão em centavos (R$ 99,99 e outras) | passou | `money.test.mjs`, `asaas.spec` (9999 = 1000 + restante) | pago = profissional + plataforma + taxa do gateway |
| 15 | Profissional recebe em "Pedidos recebidos", aceita, executa, conclui; cliente confirma e confirmação automática | passou | `pedido-anuncio.spec`, `pagamento-asaas` | prazo automático simulado com data no banco |
| 16 | Cancelamento, reembolso, disputa e decisão do admin | passou | `pagamento-asaas` | reembolso total, parcial e por política |
| 17 | Pedido sem recebimento aprovado: fluxo bloqueia com mensagem clara | passou | `asaas.spec`, `pedido-anuncio.spec`, `pagamento-asaas` | |
| 18 | Pedido aberto: passo a passo, máscara de contato, rascunho | passou | `pedido-aberto` (82), `pedido-aberto.spec` | números com 8+ dígitos (CEP) são escondidos: deliberado |
| 19 | Oportunidades: compatível vê, incompatível não, contador some ao ver | passou | `pedido-aberto`, `pedido-aberto.spec`, `notificacoes` | |
| 20 | Proposta (uma por pedido, edição, limite 5), comparar, aceitar, origem `pedido_aberto`, pagamento, conclusão | passou | `pedido-aberto`, `pedido-aberto.spec` | demais propostas recusadas com aviso gentil |
| 21 | Expiração (tempo simulado), cancelamento, renovação, denúncia e remoção pelo admin | passou | `pedido-aberto`, `pedido-aberto.spec` | rotina real rodada em outro processo |
| 22 | Flag `OPEN_REQUESTS_ENABLED=false` | passou | `pedido-aberto-desligado` (8) | telas somem, rotas respondem 404, pedidos antigos continuam |
| 23 | Conversa em tempo real (2 sessões), imagem, ordem, reconexão | corrigido | `mensagens.spec`, `mensagens-completo` (96) | ver "Bugs" |
| 24 | Contador de mensagens: aparece, some ao abrir, volta com mensagem nova, não afeta outra conta; privacidade da leitura | passou | `mensagens-leitura` (16), `mensagens.spec` | |
| 25 | Notificações: eventos certos, contador some, outra aba, preferências | passou | `notificacoes` (24) | |
| 26 | Contadores independentes | passou | `notificacoes`, `responsivo.spec` | |
| 27 | Criar serviço (passo a passo), editar, pausar, excluir; alternar modos; onboarding de recebimento | passou | `anuncios-profissional` (149), `profissional.spec`, `pagamento-asaas` | subconta aprovada no Asaas simulado |
| 28 | "Pedidos recebidos" fora do menu inicial | passou | `responsivo.spec` | rota `/pro/pedidos` mantida (sem link quebrado) |
| 29 | Todas as telas do admin, sem erro; ações | passou | `admin-rotas`, `responsivo.spec`, `pedido-aberto.spec`, `assistente-ajuda` | 9/9 rotas, todas as abas |
| 30 | Usuário comum recebe 403 no admin | passou | `admin-rotas`, `seguranca-extra`, `admin-smoke.test.mjs` | |
| 31 | Autorização cruzada A não toca em dados de B | passou | `seguranca-autorizacao` (27), `seguranca-extra` (55) | pedidos, conversas, propostas, pagamentos, favoritos, notificações |
| 32 | Validação, injeção, XSS, upload falso, tamanho, rate limit | passou | `seguranca-extra`, `auth-extra` | SVG, HTML com extensão .png e executável recusados |
| 33 | Cabeçalhos, CORS, segredos no pacote do site | passou | `seguranca-extra`, `seguranca-desempenho.spec` | nenhum segredo nos arquivos publicados; sem `dangerouslySetInnerHTML` |
| 34 | Webhooks e rotas internas sem autenticação | passou | `seguranca-extra`, `webhooks-ordem` | |
| 35 | 375/768/1280 px: nada quebrado, foco por teclado, textos, estados, console | passou | `responsivo.spec` (138 execuções) | sem rolagem horizontal; sem erro no console |
| 36 | Desempenho básico | passou | `seguranca-desempenho.spec` | telas em menos de 6 s, nenhum arquivo acima de 700 KB, sem requisição repetida em laço |
| 37 | Produção: migrations, variáveis, checklist | passou (verificação) | seção abaixo | nada foi alterado em produção |

## Bugs e correções

| # | Onde | Problema | Causa raiz | Correção e regressão |
| --- | --- | --- | --- | --- |
| 1 | Mensagens (`ConversationView.jsx`) | Quem digitava a próxima mensagem enquanto a anterior ainda era enviada perdia o texto | o campo era limpo (`setText('')`) quando o envio terminava, apagando o que foi digitado nesse intervalo | limpa só se o texto ainda for o que foi enviado. Teste novo `o que a pessoa digita durante um envio lento não se perde` (atrasa a resposta do servidor): **falha sem a correção nos 3 tamanhos de tela e passa com ela** |
| 2 | Teste de mensagens | instável (cerca de 1 em 4 execuções) | era a causa do item 1, exposta pelo teste que digitava rápido demais | resolvido pela correção; 18 execuções seguidas verdes depois |

Falhas que **não** eram do sistema (testes desatualizados ou com suposição errada, corrigidos): endereço do serviço agora é obrigatório em pedido na casa do cliente; rotas antigas `/users/:uuid` e `/professionals/*` removidas (CLAUDE.md); chave Pix só em Configurações > Pagamentos; hora por quantidade já tem valor conhecido; limite de login e de cadastro nos próprios testes; cache de login entre processos; localizadores ambíguos; número longo em título virando `[contato removido]` (a máscara estava certa).



## Cobertura: automatizado e manual

**Automatizado:** tudo da tabela acima, exceto os itens 4 (Google), a confirmação do pagamento no painel do Asaas de verdade (itens 10 e 12) e o webhook real chegando por túnel. O Asaas simulado reproduz as respostas do gateway (clientes, subcontas, cobranças, QR Code, estorno, split) e o próprio teste envia os avisos (webhook) com o token de teste.

**O que ficou fora, e por quê:**
- **Asaas real:** nunca foi testado aqui (precisa de internet exposta, de chave de sandbox e de cliques no painel). É o maior risco restante.
- **Google:** não há cliente OAuth de desenvolvimento autorizado para `localhost`.
- **E-mail, SMS e Cloudinary reais:** desligados de propósito (regra do teste).
- **Navegadores além do Edge:** só o Edge foi usado.
- **Carga e concorrência pesada:** só o básico (limites de requisição e pedidos paralelos); não houve teste de carga.
- **Acessibilidade com leitor de tela real:** conferi foco por teclado, rótulos, papéis (`dialog`, `log`, `tab`) e o atalho "Pular para o conteúdo", mas não usei um leitor de tela.


## Passos manuais (o que não dá para automatizar com o Asaas de verdade)

Estes passos usam o **sandbox** do Asaas e o seu backend de teste. Nunca use chaves de produção.

1. **Webhook real chegando ao seu backend (túnel).** O backend local (porta 3000) não é visível da internet. Instale um túnel gratuito (por exemplo `cloudflared`) e rode `cloudflared tunnel --url http://localhost:3000`. Copie o endereço `https://….trycloudflare.com`. No painel do **sandbox** do Asaas, em *Integrações > Webhooks*, cadastre `https://…trycloudflare.com/api/payments/webhook/asaas`, com o **mesmo token** de `ASAAS_WEBHOOK_TOKEN` e a fila ativa. Se o aviso não chegar, confira: (a) a porta do túnel é a do backend; (b) a URL termina em `/api/payments/webhook/asaas`; (c) o token do painel é idêntico ao do `.env`; (d) a fila do Asaas não foi pausada (15 falhas seguidas pausam). O painel do administrador, aba *Avisos do gateway*, mostra o que chegou e o que deu erro.
2. **Aprovar a subconta do profissional.** Em *Configurações > Pagamentos > Como recebo*, cadastre a conta e clique em *Aprovar conta de teste (sandbox)*. Se o botão falhar, aprove no painel do sandbox e use *Atualizar status*.
3. **Confirmar o Pix.** No painel do sandbox do Asaas, abra a cobrança criada pelo Dommos e use a opção de simular/confirmar o pagamento (o nome do botão pode variar). A tela do pedido deve virar "Pagamento confirmado" sozinha.
4. **Cartão e boleto.** Use os cartões de teste que o Asaas publica na documentação do sandbox (não os invente). Para o boleto, simule a compensação no painel do sandbox.
5. **Login com Google.** Só funciona nos domínios autorizados no cliente OAuth do Google. Para testar localmente, adicione `http://localhost:5173` às origens autorizadas e use um cliente OAuth de desenvolvimento.
6. **E-mail e Cloudinary reais.** Foram desligados de propósito nos testes. Para conferir em produção, use `node --env-file=.env scripts/check-email.mjs --send seu@email.com` e envie uma foto pelo site.

## Produção: verificação (nada foi alterado em produção)

**Migrations** que o código espera (todas precisam estar aplicadas; confira com `npx prisma migrate status` e em `/health`, campo `database`): as 40 migrations da pasta `backend/prisma/migrations`, até `20261116100000_open_requests`. As quatro últimas desta fase: `20261113100000_admin_audit_alerts`, `20261114100000_order_proposals`, `20261115100000_help_assistant` e `20261116100000_open_requests`.

**Variáveis no Render** (nomes, sem valores): obrigatórias `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `JWT_SECRET` (32+ caracteres aleatórios), `FRONTEND_URL` (HTTPS, a origem do site na Hostinger), `NODE_ENV=production`, `TRUST_PROXY=1`. Fotos: `STORAGE_PROVIDER=cloudinary`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `PUBLIC_BASE_URL`. E-mail: `BREVO_API_KEY`, `EMAIL_FROM`. Pagamento: `PAYMENT_PROVIDER` (`manual` por padrão), e só para o Asaas `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` (32+), `SECRETS_KEY`, `PUBLIC_API_URL`. Opcionais: `GOOGLE_CLIENT_ID`, `SUPPORT_EMAIL`, `OPEN_REQUESTS_ENABLED` e demais `OPEN_REQUEST_*`.

**Checklist de deploy:**
1. Backup do banco; `npx prisma migrate status`; `npx prisma migrate deploy`; `/health` com `"database":"ok"`.
2. Backend publicado (Render) e `/health` com `storage: cloudinary` e `email: brevo`.
3. Front compilado com `VITE_API_URL=https://SUA-API/api` (o build de produção **recusa** URL ausente, `localhost`, sem HTTPS ou sem `/api`), arquivos de `dist` na Hostinger, `.htaccess` mantido.
4. `PAYMENT_PROVIDER`: confirmado que o padrão é o pagamento direto (manual); o Asaas só liga com a chave, o token de 32+ caracteres **e** `PAYMENT_PROVIDER=asaas`; sem `SECRETS_KEY` o cadastro de recebimento é recusado **antes** de criar qualquer conta no gateway.
5. Webhook do Asaas de produção recadastrado com o token de produção (depois da aprovação da conta PJ).


## Riscos restantes (do mais grave ao menos grave) e o que fazer antes de produção

1. **Pagamento pelo Asaas nunca foi exercitado contra o Asaas real.** Só contra o simulado. Podem divergir: atualização do split, quem arca com a taxa do gateway quando há split, liquidação do boleto, prazos do cartão (32 dias). *Antes de produção:* fazer o roteiro manual no **sandbox** (Pix, cartão, boleto, estorno, reclamação) e conferir cada valor no painel do Asaas.
2. **Subcontas e split exigem conta Asaas PJ (CNPJ) aprovada.** Em CPF só funciona no sandbox. *Até lá:* manter `PAYMENT_PROVIDER=manual` (pagamento direto entre as partes) em produção. O sistema já volta sozinho a esse modo se a configuração do Asaas estiver incompleta.
3. **Hospedagem do backend que dorme (plano gratuito do Render).** Se o servidor estiver dormindo quando o Asaas enviar um aviso, o aviso pode falhar, e o Asaas **pausa a fila de webhook depois de 15 falhas seguidas**. *Antes de produção com Asaas:* serviço sempre ligado (ou monitoramento), e olhar o painel do administrador, aba "Avisos do gateway".
4. **Dados pessoais sem criptografia em repouso:** CPF, CNPJ e chave Pix ficam em texto no banco. *Antes de abrir ao público:* decidir a criptografia desses campos (LGPD) e revisar a política de privacidade.
5. **Limites de requisição em memória (uma instância).** Reiniciar o servidor zera os limites; com mais de uma instância cada uma conta separado. Basta para o começo; ao escalar, mover para um armazenamento compartilhado.
6. **Migrations e backup em produção são manuais.** Rode `npx prisma migrate status` antes de cada publicação e faça backup. O `/health` mostra `migrations-pendentes` se esquecer.
7. **E-mail e imagens dependem de configuração externa** (Brevo sem restrição de IPs e com remetente verificado; variáveis do Cloudinary no Render). Funcionavam no último teste real, mas o teste automático não cobre esses serviços.
8. **Termos de uso, política de privacidade e de cancelamento** precisam de revisão jurídica antes de divulgar, principalmente as regras de pagamento, comissão e reembolso.
9. **Só o Edge foi testado no navegador, sem teste de carga e sem leitor de tela real.** Vale uma rodada rápida manual no Chrome, no Safari do iPhone e no Firefox, e um teste de carga simples antes de uma divulgação grande.
10. **Máscara de contato do pedido aberto** esconde qualquer número com 8 ou mais dígitos (CEP incluso) no título e na descrição. É deliberada (privacidade), mas pode surpreender quem escreve o CEP no pedido.

## Veredito

**Pronto com ressalvas.**

- **Pronto** para publicar e usar com o **pagamento direto** (modo manual): conta, busca, pedidos por anúncio, pedido aberto, propostas, mensagens, notificações, painel do profissional e do administrador, moderação e segurança passaram em mais de mil verificações automáticas, em três tamanhos de tela, e o único defeito de produto encontrado (texto digitado durante um envio lento) foi corrigido com teste.
- **Não pronto** para cobrar pelo Asaas em produção: falta validar no sandbox real (item 1), ter a conta PJ aprovada (item 2) e garantir servidor sempre ligado para receber os avisos (item 3).
