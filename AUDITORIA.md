# Auditoria do Dommos

Início: 05/11/2026. Base: leitura de todas as rotas de `frontend/src/App.jsx`, das páginas, dos componentes e dos controllers usados por elas.

**Gravidade:** alta = impede o fluxo, leva ao lugar errado ou engana o usuário; média = atrapalha ou confunde; baixa = acabamento.
**Status:** Corrigido (verificado), Parcial (melhorou, falta algo), Aberto (não tratado), Não reproduzido.

## Resumo da rodada 1 (auditoria, navegação, tokens e upload)

| Verificação | Resultado |
| --- | --- |
| `npm run lint` (frontend) | 0 erros (antes: 4) |
| `npm run build` (frontend) | passa, com o aviso de bundle acima de 500 kB (567 kB) |
| `npm test` (backend, 16 testes) | 16 passam: 11 do fluxo de serviço e publicação, 5 novos de upload |
| API contra banco local temporário (33 verificações) | 33 passam: upload, permissões, pedidos com fotos, "meus pedidos", busca |
| Navegador real (Edge, 71 verificações) | 71 passam, sem erro de console nem resposta 5xx |

Tudo foi testado em um MariaDB local temporário (porta 3307), criado só para isso e desligado ao final. **O banco remoto do `.env` não foi tocado.** A migration nova **ainda não foi aplicada nele**; veja "Pendências".

## 1. Problemas encontrados

| Página/rota | Problema | Gravidade | Status |
| --- | --- | --- | --- |
| Qualquer URL inválida | **A01** Sem rota 404 nem `errorElement`: tela padrão do React Router, em inglês | alta | Corrigido: `NotFound` e `RouteError` |
| `/` (Landing) | **A02** "Contratar profissional", "Ver serviços" e categorias levavam a `/servicos` (pedidos de clientes) | alta | Corrigido: levam a `/buscar` |
| `/` (Landing) | **A03** Números inventados (+500, +1.200, 4.9★) | alta | Corrigido: removidos |
| `/` (Landing) | **A04** Depoimentos fictícios, citando "pagamentos seguros" que não existem | alta | Corrigido: removidos |
| `/` (Landing) | **A05** Categorias fixas no código, fora do catálogo do banco | média | Corrigido: vêm de `/categories`, com carregando e erro |
| `/` (Landing) | **A06** "Cadastrar como profissional" ia ao fluxo de cliente | média | Corrigido: `?tipo=profissional` |
| `/` (Landing) | **A07** Texto de "freelance" e "milhares de profissionais" | média | Corrigido: texto reescrito |
| `/servicos` | **A08** Bloco com `hidden`: filtros e erro nunca apareciam; falha de API virava "não há serviços" | alta | Corrigido: página reescrita como "Pedidos abertos" |
| `/servicos` | **A09** "Mais de 500 profissionais" inventado | média | Corrigido |
| `/servicos` | **A10** Código morto de "busca preparada" | baixa | Corrigido |
| `/servicos`, `/servicos/novo` | **A11** "Budget" em inglês | baixa | Corrigido: "Orçamento" |
| `/buscar` | **A12** Sem cidade e data, mostrava erro e título quebrado | alta | Corrigido: cidade, data e serviço são opcionais; a API aceita busca sem filtros |
| `/buscar` | **A13** "Melhor avaliação" e "Preço" pareciam botões e não faziam nada | média | Corrigido: removidos |
| `/buscar` | **A14** Contador ignorava filtros, "Limpar filtros" duplicado, botão fechar sem rótulo | média | Corrigido |
| `/buscar` | **A15** Sem paginação (a API devolve 12 por página) | média | Corrigido |
| `/buscar` | **A16** "Alterar busca" levava a `/servicos` | média | Corrigido: "Ver todos os profissionais" |
| Busca | **A17** "Usar minha localização" enviava a cidade "Perto de você", e a busca vinha sempre vazia | alta | Corrigido: opção removida (sem geocodificação, não funcionava) |
| Busca | **A18** Rótulo "Qual serviço" e componente sem uso | baixa | Corrigido |
| Cabeçalho | **A19** Faltavam abas de categoria, busca no topo, botão de modo e item ativo | alta | Corrigido (Etapa B) |
| Cabeçalho | **A20** Menus de desktop e mobile diferentes, "Sair" duplicado, sem fechar com Esc | média | Corrigido: um menu só, com Esc e clique fora |
| Área de anúncio | **A21** Cinco rótulos diferentes levavam ao mesmo formulário | alta | Corrigido: "Vou trabalhar", card "Torne-se um profissional", "Criar/Editar perfil profissional" |
| Área de anúncio | **A22** "Publicar serviço" e "Meus serviços" pareciam anúncio do profissional | alta | Corrigido: renomeados para "Publicar pedido" e "Pedidos e contratações" |
| Área de anúncio | **A23** Três telas sobrepostas para o profissional | média | Parcial: `/configuracoes/profissional` agora só aponta para o perfil e o painel; `/perfil/resumo-profissional` ainda existe |
| Área de anúncio | **A24** Não existe anúncio de serviço criado pelo profissional | alta | Aberto: depende da decisão de produto (Prompt 3) |
| `/meus-servicos` | **A25** Filtrava no navegador os 20 pedidos mais recentes da plataforma | alta | Corrigido: `GET /services/mine` |
| `/meus-servicos` | **A26** Seletor oferecia status que a API recusa e mostrava rascunho como "Aberto" | alta | Corrigido: ações "Cancelar" e "Excluir", com confirmação |
| `/meus-servicos` | **A27** Sem link para as propostas | média | Corrigido |
| `/meus-servicos`, `/servicos/novo`, `/enviar-proposta` | **A28** Sem `ProtectedRoute` | alta | Corrigido |
| `/servicos/novo` | **A29** Depois de publicar, limpava o formulário e ficava na tela | média | Corrigido: vai para o pedido criado |
| `/servicos/novo` | **A30** Labels sem ligação com os campos; falha de categorias silenciosa | média | Corrigido: `Input`/`Select` ligam rótulo, ajuda e erro; foco no primeiro erro |
| `/servicos/novo` | **A31** Pedido sem fotos | alta | Corrigido: galeria com capa (`service_images`) |
| `/servicos/:uuid` | **A32** Só "Carregando..." em texto, sem breadcrumb | baixa | Corrigido |
| `/servicos/:uuid/propostas` | **A33** Sem link para o perfil de quem enviou a proposta | alta | Corrigido |
| `/servicos/:uuid/propostas` | **A34** Aceitar e recusar sem confirmação nem retorno; contraste do botão verde 2,5:1 | média | Corrigido |
| `/servicos/:uuid/propostas` | **A35** Erro misturado com "nenhuma proposta"; "— dias" sem prazo | média | Corrigido |
| `/enviar-proposta` | **A36** Sucesso nunca visto; `min-h-screen` aninhado; "Cancelar" com `navigate(-1)` | média | Corrigido. Achado extra: a API recusava apresentação vazia; o formulário agora omite o campo vazio e valida o mínimo de 20 caracteres |
| `/servicos/:uuid/avaliar` | **A37** Sem padrão visual, sem breadcrumb | baixa | Corrigido |
| `/profissionais/:uuid` | **A38** Sem como contatar o profissional; sem avaliações | alta | Parcial: avaliações e atalho para "Publicar um pedido". Contato direto depende de Mensagens (A68) |
| `/profissionais/:uuid` | **A39** "Habilidades" sempre vazia; serviços não exibidos | média | Corrigido: mostra os serviços do catálogo |
| `/profissionais/:uuid` | **A40** Toda falha virava "não encontrado", sem tentar de novo | média | Corrigido |
| `/perfil/sobre` | **A41** Sem como enviar foto de perfil | alta | Corrigido: `ImageUploader` com recorte |
| `/perfil/sobre` | **A42** "Complete seu perfil" aparecia sempre | baixa | Corrigido: só se faltar cidade ou telefone |
| `/perfil/resumo-profissional` | **A43** "R$ 0,00" para quem cobra sob orçamento | baixa | Corrigido |
| `/perfil/profissional` | **A44** Foto e portfólio exigiam colar links | alta | Corrigido: `ImageUploader` (avatar e galeria de 12) |
| `/perfil/profissional` | **A45** Erros de validação num único texto genérico | média | Aberto: mensagens da API juntas no topo, sem erro por campo |
| `/configuracoes/*` | **A46** Seis seções "Em breve" | alta | Corrigido: removidas as que não têm funcionalidade (segurança, privacidade, notificações, pagamentos); "Idioma e moeda" e "Área profissional" têm conteúdo |
| `/configuracoes/notificacoes` | **A47** Duplicava `/notificacoes` | média | Corrigido: removida |
| `/configuracoes/pessoais` | **A48** "Concluir" levava a `/servicos` | média | Corrigido: leva a `/perfil` |
| `/configuracoes/pessoais/verificacao-identidade` | **A49** Pede CPF e endereço, mas não salva nem verifica nada | média | Parcial: botão renomeado para "Conferir dados" e texto honesto; o fluxo em si não muda |
| `/login` | **A50** Sempre voltava a `/` | média | Corrigido: volta à página que o usuário tentou abrir |
| `/login`, `/cadastro` | **A51** Falhas viravam "Dados inválidos" | média | Corrigido: mensagem por campo |
| `/cadastro` | **A52** Cliente caía em Configurações | média | Corrigido: vai para `/` (profissional vai ao perfil) |
| `/cadastro` | **A53** Sem login com Google | baixa | Corrigido no código (aparece se `VITE_GOOGLE_CLIENT_ID` existir). Não testado, pois exige credencial real |
| `/forgot-password` | **A54** Falha de rede mostrava mensagem de sucesso | média | Corrigido |
| `/reset-password` | **A55** Sem checar token; formulário continuava após o sucesso | média | Corrigido |
| `/sair` | **A56** "Saindo..." sem estilo | baixa | Corrigido |
| `/notificacoes` | **A57** Paginação e carregamento sem estilo | baixa | Corrigido |
| Rotas protegidas | **A58** Sessão expirada gerava erros soltos | média | Corrigido: o 401 encerra a sessão e leva ao login (verificado no navegador) |
| `ProtectedRoute` | **A59** Renderizava `null`; sem permissão, redirecionava sem explicar | média | Corrigido |
| Páginas órfãs | **A60** `OnBoarding.jsx`, `App.css`, `react.svg`, `vite.svg`, `hero.png`, `icons.svg` | baixa | Corrigido: removidos (busca confirmou que nada os referenciava) |
| Global (visual) | **A61** 670 cores soltas e três paletas misturadas | alta | Corrigido: 0 cores soltas em páginas e componentes |
| Global (visual) | **A62** Botão primário em três cores; raios e alturas variados | média | Corrigido: `Button`, `rounded-control/card/panel`, altura mínima 44 px |
| Global (acessibilidade) | **A63** Contraste abaixo de AA e foco visível irregular | alta | Corrigido: paleta nova validada; foco global em `index.css` |
| Global (acessibilidade) | **A64** Borda sem cor usava a cor do texto | baixa | Corrigido |
| Global (componentes) | **A65** Sem componentes base | média | Corrigido: `components/ui/` |
| Global (navegação) | **A66** Sem breadcrumb e links de voltar inconsistentes | média | Corrigido nas telas de fluxo; telas com menu lateral (perfil, configurações) não precisam |
| Global (texto) | **A67** Nome varia; `lang="en"`; título "frontend"; favicon do Vite | média | Parcial: `lang`, título e textos da interface agora dizem "Dommos". Faltam o favicon e o "DOMMOS" dos e-mails e SMS do backend |
| Mensagens | **A68** Chat, mídia e respostas rápidas não existem | alta | Aberto: a rota `/mensagens` mostra aviso de "ainda não disponível" |
| Favoritos | **A69** Não existe | alta | Aberto: a rota `/favoritos` mostra aviso de "ainda não disponível" |
| Pagamento | **A70** Não existe | alta | Aberto |
| API | **A71** `console.log` do registro inteiro e logs com `nome_da_função` | média | Corrigido |
| API | **A72** UUID malformado retornava 500 | média | Não reproduzido: serviços, profissionais e usuários respondem 404 |
| API | **A73** CORS e porta fixos | média | Corrigido: `FRONTEND_URL` e `PORT` |

## 2. Upload de foto

Componente único: `frontend/src/components/ImageUploader.jsx` (variantes `avatar` e `gallery`).

| Local | Hoje |
| --- | --- |
| Avatar do perfil (`/perfil/sobre`) | Feito: recorte quadrado, salva no usuário e aparece no cabeçalho |
| Foto pública do profissional | Feito: avatar, finalidade `professional` |
| Portfólio do profissional | Feito: galeria de até 12 |
| Capa e galeria do pedido | Feito: galeria de até 10, a primeira é a capa |
| Mídia de mensagens e fotos de respostas rápidas | **Pendente**: a API já aceita as finalidades `message` e `quick_reply`, mas as telas não existem |

**Cliente:** seleção por clique e por arrastar e soltar; prévia; barra de progresso; remover; só JPG, PNG e WebP até 5 MB, com mensagens em português; redução para 1600 px e recompressão em WebP (JPEG se o navegador não gerar WebP), o que também descarta metadados como GPS.

**Servidor** (`POST /api/uploads`, `DELETE /api/uploads`): exige login e conta ativa; limite de 5 MB e de um arquivo; reconhece o tipo **pelo conteúdo**, ignorando nome e tipo declarados; nome gerado pelo servidor (`<uuid-do-usuario>/<finalidade>/<uuid>.<ext>`); 60 envios a cada 15 minutos por usuário; só remove arquivos da própria pasta e rejeita `..`. Arquivos locais saem com `nosniff`.

**Armazenamento:** não havia nenhum. Escolhi um provedor trocável por `STORAGE_PROVIDER`:
- `local` (padrão): grava em `backend/uploads` (fora do git). Serve para desenvolvimento; **não serve para produção** (o disco de hospedagens gratuitas costuma ser apagado a cada deploy).
- `cloudinary`: para produção, com as variáveis `CLOUDINARY_*`. Ainda **não foi testado contra a conta real**; só a assinatura dos envios tem teste com o exemplo da documentação. O plano gratuito é de 25 créditos por mês (1 crédito = 1 GB de armazenamento ou de banda, ou 1.000 transformações) e não pede cartão, segundo fontes de terceiros; **não consegui abrir a página oficial de preços, então confirme os limites atuais antes de depender dele**. A alternativa que avaliei, o Supabase, tem 1 GB de arquivos no plano gratuito, mas pausa projetos após 7 dias sem uso.
- Para adicionar outro provedor, implemente `save()` e `remove()` em `backend/src/services/storage/` e registre em `index.js`.

## 3. Paleta e tokens

Tudo está em `frontend/src/index.css`, no bloco `@theme`. A paleta padrão do Tailwind foi desativada: só existem os tokens do Dommos, então usar uma cor solta falha em vez de passar despercebido.

**Avaliação da paleta anterior:** o violeta combina com o logo e não lembra o rosa/vermelho do Airbnb, então **mantive a família violeta**. Os problemas eram outros: três escalas misturadas para a mesma função (`#7C3AED`, `violet-*`, `emerald-*` no botão), texto cinza `#9CA3AF` com 2,5:1 de contraste, vermelho de erro com 3,8:1 e botão branco sobre verde com 2,5:1, todos abaixo do mínimo AA.

| Papel | Token | Valor | Contraste medido |
| --- | --- | --- | --- |
| Primária (ações) | `primary` | `#6D28D9` | 7,1:1 sobre branco, com texto branco no botão |
| Primária, hover | `primary-hover` | `#5B21B6` | 9,0:1 |
| Primária, texto sobre fundo suave | `primary-strong` / `primary-soft` | `#4C1D95` / `#F1ECFB` | 9,5:1 |
| Fundo de destaque | `primary-deep` | `#3B1778` | 13,3:1 com texto branco |
| Secundária (apoio) | `secondary` | `#0F766E` (verde-azulado) | 5,5:1 sobre branco |
| Texto | `ink` / `ink-soft` / `ink-muted` | `#1C1730` / `#413B55` / `#615B75` | 16,5:1 / 10,6:1 / 6,4:1 |
| Borda de campo | `line-strong` | `#8A849C` | 3,6:1 (mínimo de 3:1 para componentes) |
| Bordas e fundos | `line`, `surface`, `surface-muted`, `canvas` | `#E4E1EB`, `#FFFFFF`, `#F3F1F7`, `#FAF9FC` | n/a |
| Sucesso | `success` | `#166534` sobre `#E8F6EC` | 6,4:1 |
| Alerta | `warning` | `#92400E` sobre `#FDF3E1` | 6,4:1 |
| Erro | `danger` | `#B91C1C` | 6,5:1 sobre branco, 5,7:1 sobre o fundo suave |
| Informação | `info` | `#1D4ED8` sobre `#E9F0FE` | 5,9:1 |

Também centralizados: tipografia (Inter no texto e Plus Jakarta Sans nos títulos), raios (`control`, `card`, `panel`), sombras (`card`, `raised`, `overlay`), alturas de controle e larguras de página. As animações respeitam `prefers-reduced-motion`.

**Componentes base** (`frontend/src/components/ui/`): `Button`, `Input`/`Textarea`/`Select`, `Modal` e `ConfirmDialog` (também usado como gaveta e tela cheia), `Dropdown`, `Toast`, `Card`, `Avatar`, `Skeleton`, `EmptyState`/`ErrorState`, `Breadcrumb`. Os que já existiam (`UnsavedChangesDialog`, avatar e confirmações de cada página) foram trocados ou passaram a usar os tokens.

## 4. Navegação (Etapa B)

- **Barra superior:** logo, abas de categoria (do banco, com item ativo), busca Onde / Quando / Que tipo de serviço, botão de modo, avatar e menu. No mobile a busca abre em tela cheia.
- **Botão de modo:** "Vou trabalhar" no modo cliente, "Vou contratar" no profissional. A escolha fica salva por conta no navegador e sobrevive a recarregar a página. Quem ainda não é profissional é levado ao cadastro do perfil. **O conteúdo do modo profissional continua sendo o painel atual; a área nova é o Prompt 3.**
- **Menu do avatar:** Favoritos, Pedidos e contratações, Mensagens, Perfil, Notificações, Configurações da conta, Idioma e moeda, Central de Ajuda e Sair da conta; o card "Torne-se um profissional" aparece para quem ainda não tem perfil. Item ativo marcado, fecha com Esc e clique fora, com contador de notificações. "Indique um profissional" ficou de fora, como combinado.
- **Mobile:** menu inferior (Explorar, Favoritos, Pedidos, Mensagens, Menu) e gaveta lateral com o mesmo menu.
- **Telas novas:** `/ajuda` (conteúdo real, com as limitações atuais descritas), `/favoritos` e `/mensagens` (avisam que ainda não existem, em vez de levar a lugar nenhum), 404.

## 5. Estados de tela

Carregando (esqueleto), vazio e erro com "Tentar novamente" nas telas reescritas: pedidos abertos, busca, pedidos e contratações, propostas, avaliação, perfil público, notificações, landing (categorias) e perfil. Nenhuma foi medida com leitor de tela; a verificação de acessibilidade foi por contraste calculado, foco visível, rótulos ligados aos campos e navegação por teclado no recorte e no menu.

## 6. Pendências

**Para você fazer**
1. **Aplicar a migration `20261105120000_add_service_images` no banco real** (`npx prisma migrate deploy`, em `backend/`, com o `.env` correto). Sem isso, criar e listar pedidos falha na API real, que já usa a tabela nova. Foi testada apenas no banco temporário. O banco real tem uma migration (`20260915160000_professional_onboarding`) que o `PERSONAL_SETTINGS_HANDOFF.md` descreve como ausente deste checkout; confira o `migrate status` antes de aplicar.
2. Reiniciar o backend (já usa `multer`, instalado em `backend/package.json`) e, para produção, escolher e configurar o provedor de fotos.
3. Decidir a grafia oficial do nome (a interface agora usa "Dommos", igual ao logo) e a direção do modelo de anúncios (A24).

**Para a próxima rodada**
- Os testes de navegador antigos em `backend/tests/personal-settings-browser.mjs` e `identity-verification-browser.mjs` **não foram executados nem atualizados**; eles usam o banco do `.env` e procuram textos e botões que mudaram (menu, "Concluir"). Devem ser revisados antes de voltarem a ser usados.
- A24 (anúncio do profissional), A68 a A70 (mensagens, favoritos, pagamento) e a área do modo profissional (Prompt 3).
- A23, A45 e A49 (parciais) e A67 (favicon e e-mails/SMS com "DOMMOS").
- Remover o `Twilio` do caminho obrigatório de SMS, por ser pago (regra de soluções gratuitas).
- Reduzir o pacote do frontend (567 kB) com carregamento por rota.
- Arquivos enviados que o usuário abandona sem salvar o formulário ficam no armazenamento; falta uma rotina de limpeza.
- `frontend/.env` continua versionado apesar de estar no `.gitignore` do frontend.
- Conferir com leitor de tela e em dispositivos reais; a verificação foi no Edge sem interface gráfica (1366 px e 390 px).


---

# Rodada 2

## Fase 1: área do usuário (concluída)

| Verificação | Resultado |
| --- | --- |
| `npm run lint` (frontend) | 0 erros |
| `npm run build` (frontend) | passa |
| `npm test` (backend) | 26 testes passam (inclui preferências de notificação, e-mails só depois do commit, bloqueio, documentos, perfil) |
| `npm test` (frontend) | 5 testes passam (integridade e busca da Central de Ajuda) |
| API contra banco temporário | 131 verificações passam (sessões, senha, Google, configurações, perfil, privacidade, bloqueios, favoritos, ajuda, exportação, desativar e excluir) |
| Navegador real (Edge, 80 verificações) | 80 passam, sem erro de console nem resposta 5xx |

Banco: nova migration `20261106100000_user_area` (8 tabelas e colunas em `users`). Aplicada só no banco de teste. **Falta aplicar no banco real.**

### O que foi entregue

| Pedido | Entrega | Status |
| --- | --- | --- |
| Favoritos | `/favoritos` com suas listas, criar, renomear e excluir; `/favoritos/:id`; lista automática "Vistos recentemente"; coração na busca, no perfil profissional e no perfil público, salvando no banco; estado vazio com "Explorar serviços" | Corrigido |
| Coração em todos os cards | Cartões de profissional da busca, das listas e dos vistos recentemente. Os cartões de anúncio entram na Fase 2 | Parcial (fecha na Fase 2) |
| Perfil, duas abas | "Sobre mim" e "Conexões", com avatar, nome, papel, "Preencha seu perfil" (com progresso) e link "Mostrar avaliações que escrevi" | Corrigido |
| Botão "Editar" | Abre `/perfil/editar` ("Meu perfil"), não mais as configurações. Foto com `ImageUploader`, cidade, profissão, anos de experiência, onde estudei, idiomas, habilidades, áreas de atuação, interesses, curiosidade e "Sobre mim". Campos de viagem removidos. "Concluído" valida, salva, avisa e volta ao perfil | Corrigido |
| Perfil público | `/usuarios/:uuid`, respeitando quem pode ver (todos, só com conta, só conexões); versão restrita mostra nome e foto; profissional mostra serviços, nota e avaliações recebidas; bloquear e desbloquear | Corrigido |
| Configurações | Menu: Informações pessoais, Login e segurança, Privacidade, Notificações, Impostos (só profissionais), Pagamentos (casca), Idioma e tradução. "Permissões de reserva" e "Viagem a trabalho" não existiam. Seções vazias "em breve" foram substituídas | Corrigido |
| Informações pessoais | Já tinha confirmação de e-mail e telefone por código. Renomeado "Nome de preferência" para "Nome de exibição" (aparece no perfil público) | Corrigido |
| Login e segurança | Alterar ou criar senha; Google conectar e desconectar (com trava: sem senha não desconecta); dispositivos com sessões reais no banco e "Sair" em cada uma; desativar conta. "Acesso compartilhado" não faz sentido sem contas compartilhadas e foi omitido | Corrigido. O botão do Google não foi testado com credencial real |
| Privacidade | Quem vê o perfil; aparecer na busca; mostrar avaliações que escrevi; confirmação de leitura; pessoas bloqueadas (lista e desbloqueio); cookies; baixar meus dados em JSON ou CSV; excluir conta em duas etapas | Corrigido, com ressalvas abaixo |
| Notificações | Duas abas ("Ofertas e novidades" e "Conta"), interruptor por tipo e canal, salvo na hora e respeitado pelo sistema (no site e por e-mail) | Corrigido, com ressalvas abaixo |
| Impostos | CPF ou CNPJ validados, nome ou razão social e chave Pix, tudo mascarado na tela | Corrigido |
| Pagamentos | Rota e casca prontas, com aviso honesto | Corrigido (conteúdo vem no próximo prompt) |
| Idioma e moeda | Modal no menu (Português e Real, fixos) e página "Idioma e tradução"; configuração em `i18n/config.js` e `backend/src/utils/locales.js`; preços só por `utils/format.js` | Corrigido |
| Central de Ajuda | `/ajuda` com busca, 8 categorias e 41 artigos (de 4 a 7 por categoria); página de artigo com "Isso foi útil?", relacionados e contato; `/ajuda/contato` salva o chamado no banco; "Meus chamados" para quem está logado | Corrigido |
| Páginas legais | `/termos-de-uso`, `/politica-de-privacidade`, `/politica-de-cancelamento`, linkadas no rodapé global, com aviso de que precisam de revisão jurídica | Corrigido |

### Decisões e limites (leia antes de usar)

- **O que se favorita:** profissionais agora; anúncios na Fase 2. Pedidos de clientes não são favoritáveis.
- **Sessões:** o token passa a carregar o id de uma sessão gravada no banco, o que permite encerrar dispositivos. **Tokens antigos, sem sessão, são recusados: todo mundo precisa entrar de novo uma vez.**
- **Excluir conta:** anonimiza em vez de apagar linhas (avaliações de outras pessoas continuam íntegras), apaga favoritos, notificações, códigos e as fotos do usuário, cancela pedidos abertos e retira propostas pendentes. É bloqueada se houver serviço em andamento. A remoção de fotos funciona no armazenamento local; **no Cloudinary está implementada mas não foi testada**.
- **Notificações:** só existem os canais "No site" e "Por e-mail". Push e WhatsApp não existem e não aparecem. O e-mail só sai se o SMTP estiver configurado (`SMTP_HOST` e `EMAIL_FROM`); o envio está coberto por teste unitário, **não foi testado com um servidor de e-mail real**. As preferências valem para os 4 eventos de pedidos, propostas e avaliações.
- **"Ofertas e novidades":** o Dommos não envia nenhum comunicado de marketing hoje. A escolha fica registrada e a tela diz isso.
- **Confirmação de leitura e cookies de análise e marketing:** ficam salvos, mas ainda não têm efeito (não há mensagens nem cookies de análise). As telas dizem isso.
- **Busca:** "aparecer na busca" funciona no Dommos (busca de profissionais, e na Fase 2 a de anúncios). Não controla buscadores como o Google.
- **Conexões:** pessoas com quem houve proposta aceita (e, na Fase 2, contratações). Não há conversas.
- **Bloqueio:** a pessoa bloqueada não vê o perfil de quem bloqueou, não envia propostas aos pedidos dele e não o favorita.
- **Chamados de suporte:** ficam na tabela `support_tickets`. **Não existe painel administrativo**; quem atende consulta o banco. Se `SUPPORT_EMAIL` e o SMTP estiverem configurados, cada chamado também gera um e-mail para a equipe.
- **CPF, CNPJ e chave Pix** ficam em colunas de texto, sem criptografia em repouso. A API só devolve versões mascaradas. Criptografar é uma pendência de segurança.
- **Textos legais e artigos da ajuda** são texto-base e precisam de revisão (jurídica, no caso dos legais). Os artigos afirmam apenas o que o sistema faz, incluindo que **pagamentos e mensagens ainda não existem**.

### Removido ou unificado nesta fase

- `pages/Help.jsx` (substituída pela Central de Ajuda completa).
- `/perfil/resumo-profissional` (agora redireciona ao painel profissional).
- Seções "Em breve" de configurações (segurança, privacidade, notificações e pagamentos agora têm conteúdo) e "Área profissional" de configurações (substituída por Impostos).
- O rodapé próprio da Landing (agora o rodapé é global).
- Antes de remover, busquei referências a cada item; nada mais os usava.

### Pendências da Fase 1

- Aplicar a migration `20261106100000_user_area` no banco real.
- Criptografia em repouso de CPF, CNPJ e chave Pix.
- Painel para atender chamados.
- Testar o Cloudinary e o SMTP com contas reais.
- Cookies de análise e mensagens (para a confirmação de leitura) ainda não existem.

## Fase 2: área profissional e anúncios (concluída)

Verificação: lint sem erros, build ok (bundle de 785 kB, acima do aviso de 500 kB), 35 testes de backend e 7 de frontend, 149 checagens de API e 93 checagens em navegador (Edge sem interface) contra um MariaDB descartável. O banco real não foi tocado.

### O que foi entregue

- **Modelo novo, sem apagar o antigo:** `Listing` (anúncio do profissional) e `Order` (contratação de um anúncio). O fluxo de pedido aberto + propostas continua em "Pedidos abertos".
- **Passo a passo de 10 etapas** (`/pro/anuncio/:uuid/etapa/:n`), com barra de progresso, rodapé fixo Voltar/Avançar, "Salvar e sair", retomada do rascunho e o mesmo fluxo para editar: categoria e subcategoria, forma de atendimento, local e raio, título e descrição com contadores, fotos (mínimo 3, capa, reordenar), incluso/não incluso/requisitos/materiais, preço (hora, diária, fixo, sob consulta, pacotes, deslocamento, simulação da taxa), agenda, antecedência e cancelamento, verificação por CPF/CNPJ e revisão com prévia.
- **Área `/pro`:** Painel, Pedidos (aceitar, recusar, iniciar, concluir com valor final, agenda de disponibilidade com bloqueio de dias), Meus serviços (editar, pausar, duplicar, excluir com confirmação), Ganhos e Mensagens (aviso honesto de indisponível).
- **Vitrine pública** `/anuncios/:uuid`: galeria, profissional com nota e selo "Verificado", incluso, preço, agenda, região, avaliações, cartão de contratação fixo, favoritar e compartilhar.
- **Busca** `/buscar` (substitui a busca de profissionais): cidade, data, serviço, categoria, preço, nota, forma de atendimento e ordenação; filtros na URL.
- **Contratação:** o cliente pede com data, pacote e observações; as regras de antecedência e dias atendidos são explicadas; página `/contratacoes/:uuid`; avaliação mútua só depois de concluído.
- Notificações `order_received` e `order_update` respeitam as preferências do usuário; e-mails só saem se o SMTP estiver configurado.

### Removido ou unificado

Antes de apagar, busquei referências; nada mais usava:

- `CreateProfessionalProfile.jsx` e `OnBoarding.jsx` (viraram o passo a passo), `ProfessionalDashboard.jsx` (virou `/pro`), `ProfessionalProfile.jsx` e `ProfessionalSearch.jsx` (viraram vitrine e busca), `components/ProfessionalPrice.jsx` e `NotificationBell.jsx` (sem uso).
- `App.css`, `react.svg`, `vite.svg`, `hero.png` e `icons.svg` (assets do template, sem uso).
- Redirecionamentos mantidos: `/painel-profissional` e `/perfil/resumo-profissional` → `/pro`; `/perfil/profissional` → `/pro/comecar`; `/profissionais/:uuid` → `/usuarios/:uuid`.
- Endpoints antigos do backend (`POST /professionals`, `/professionals/search` etc.) continuam, mas a interface não os usa mais.

### Decisões e limites

- **Pagamento não existe:** o valor combinado é só registro; Ganhos soma os valores finais informados. A tela avisa isso.
- **Selo "Verificado"** só depois de análise manual: `node scripts/review-verification.mjs list|approve|reject`. Não há painel de administração.
- **Mensagens não existem:** por isso a vitrine não tem "Enviar mensagem".
- A taxa da plataforma vem de `PLATFORM_FEE_PERCENT` (padrão 0).
- A busca por data filtra em memória (até 300 anúncios por consulta); com catálogo grande, mover para SQL.

### Pendências da Fase 2

- **Aplicar no banco real**, nesta ordem: `20261105120000_add_service_images`, `20261106100000_user_area`, `20261106200000_listings_orders` (rode `prisma migrate status` antes; a `20260915160000_professional_onboarding` pode faltar). Todos precisam entrar de novo no app (sessões novas).
- Painel de administração (verificação e chamados), mensagens, pagamento, push e WhatsApp.
- Criptografia em repouso de CPF, CNPJ e Pix; testar Cloudinary, SMTP e Google com credenciais reais.
- Reduzir o bundle (divisão por rota).
- Scripts de navegador do backend (`personal-settings-browser.mjs`) seguem desatualizados.

## Rodada 3 / Fase 1: pagamentos (concluída)

Verificação: lint sem erros, build ok, 48 testes de backend (13 novos de pagamento), 84 checagens de API e 25 de navegador, contra um MariaDB descartável. O banco real não foi tocado.

### O que foi escolhido e por quê

- **Padrão, gratuito:** pagamento direto combinado (Pix, dinheiro ou cartão na maquininha, presencial). Sem integração, sem taxa, sem cadastro em terceiros. O dinheiro nunca passa pelo Dommos.
- **Pix automático opcional:** Mercado Pago, desligado por padrão. **Atenção ao "sem custo":** o Mercado Pago não cobra mensalidade, mas cobra uma taxa por transação (as fontes que encontrei citam cerca de 0,99% no Pix por checkout e variações por canal, e não consegui confirmar a tabela oficial vigente). Por isso o padrão continua sendo o direto. O valor cai na conta Mercado Pago da plataforma, que precisaria repassar ao profissional fora do sistema.
- A webhook do Mercado Pago só funciona com assinatura válida (HMAC-SHA256 conforme a documentação) e o sistema **consulta o pagamento no provedor** em vez de confiar no corpo recebido. Não consegui testar contra o Mercado Pago real (sem credenciais); testei contra um servidor falso que imita a API e a assinatura.

### O que foi entregue

- **`PaymentProvider`** (`backend/src/services/payments/`): interface única (criar cobrança, consultar status, confirmar, cancelar, estornar), com os adaptadores `manual` e `mercadopago`. Para trocar de provedor basta implementar a interface e registrar em `index.js`.
- **BR Code Pix estático** gerado localmente (`utils/pixBrCode.js`, CRC16 validado) e **QR Code** desenhado no navegador (`qrcode-generator`). Nenhuma API externa.
- **Fluxo:** cliente escolhe a forma → vê valor, chave Pix (copiar), copia e cola e QR → "Já paguei" → profissional confirma ("Confirmar recebimento") ou diz "Não recebi" → recibo. Cancelar cobrança e registrar estorno também existem. Tudo grava em `payments`, com histórico em `payment_events`.
- **Regras:** só as partes do pedido veem e agem (404 para estranhos); pagamento duplicado ou concorrente devolve o mesmo; estados inválidos dão 409; o valor da cobrança é o preço fixo (com deslocamento) ou o valor final informado na conclusão, e cobranças ainda não pagas acompanham o valor final; pedido cancelado ou recusado encerra a cobrança aberta; webhook repetido ou com valor diferente é ignorado.
- **Telas:** painel "Pagamento" no pedido; Configurações > Pagamentos com as abas "Como pago" e "Como recebo" (chave Pix, formas aceitas, lista de pagamentos e recibos); recibo imprimível em `/pagamentos/:uuid/recibo`; aviso permanente de modo gratuito e contra golpes.
- A chave Pix saiu da página Impostos e agora só se edita em Pagamentos; salvar os impostos não apaga mais a chave.

### Decisões e limites

- **Não há botão "Adicionar método" no cliente:** no modo gratuito não existe nada para cadastrar, e um botão sem função violaria a regra de não deixar botões mortos. A aba lista as formas reais. **Cartão de crédito online não aparece** porque não existe.
- O recibo é HTML imprimível (o navegador salva como PDF); não é nota fiscal.
- CPF, CNPJ e chave Pix continuam sem criptografia em repouso (pendência antiga).

### Pendências da Fase 1 (pagamentos)

- Aplicar a migration `20261107100000_payments` no banco real (depois das três anteriores).
- Testar o Mercado Pago com credenciais de teste reais e conferir a taxa vigente antes de ativá-lo.
- Repasse ao profissional no modo Mercado Pago não é automatizado.

## Rodada 3 / Fase 2: mensagens (concluída)

Verificação: lint sem erros, build ok, 53 testes de backend (5 novos de mensagens), 96 checagens de API e 41 de navegador (inclui o fluxo completo: solicita, conversa, paga por Pix, profissional confirma, conclui, cliente avalia), tudo contra um MariaDB descartável. O banco real não foi tocado.

### Tecnologia escolhida e por quê

- **WebSocket no próprio servidor Express (`ws`)**, com **consulta periódica à API como reserva**. Custo zero, sem conta em terceiros e sem limite de plano: o backend já é Node. Confirmei os limites do Supabase Realtime no plano gratuito (200 conexões simultâneas e 100 mensagens por segundo, segundo a documentação deles) e eles bastariam para começar, mas adicionariam uma dependência externa, outra camada de autenticação e um segundo lugar para guardar dados. Firebase tem as mesmas desvantagens.
- **Limite da escolha:** o WebSocket precisa de um servidor que fique ligado. Hospedagens gratuitas que "dormem" ou que não aceitam WebSocket funcionam mesmo assim, só que sem tempo real: as telas consultam a API a cada 5 a 6 segundos e o contador do menu a cada minuto. O "digitando" também funciona nesse modo (por requisição), com atraso.
- Tempo real só serve para avisar (nova mensagem, leitura, digitando). O envio e a leitura passam sempre pela API REST, com a mesma autenticação e validação.

### O que foi entregue

- **Conversa 1 a 1 ligada a um anúncio** (cliente e profissional). Abre por "Enviar mensagem" na vitrine ou "Conversar" no pedido; abrir de novo devolve a mesma conversa, mesmo em cliques simultâneos.
- **Tela** com lista à esquerda e conversa à direita (no celular, uma de cada vez), busca, estado vazio "Não há nada para ver aqui" com botão, engrenagem com Gerenciar respostas rápidas, Sugestões de respostas, Conversas anteriores e Dar feedback.
- Texto (até 2000 caracteres) e uma foto por mensagem (pelo `ImageUploader`, só fotos enviadas pelo próprio usuário para mensagens), indicador de digitando, "Visto", contador de não lidas no menu (e no menu inferior do celular), arquivar, bloquear e denunciar.
- **Confirmação de leitura respeita a Privacidade**: se a pessoa desliga, a outra não vê o "Visto" e ela também não vê o dos outros. O contador de não lidas funciona nos dois casos.
- **E-mail de mensagem nova** só quando o destinatário está offline, respeitando a preferência (novo tipo "Nova mensagem" em Notificações) e no máximo um a cada 30 minutos por conversa. Só sai se o SMTP estiver configurado.
- **Respostas rápidas**: criar, editar, excluir, variáveis (`{nome_do_cliente}`, `{servico}`, `{data}`, `{nome_do_profissional}`), vínculo a um anúncio e **envio programado de verdade** (antes do serviço, depois do serviço, pedindo avaliação com o link). Um agendador no servidor roda a cada minuto; cada modelo é enviado uma única vez por pedido, e só para pedidos dentro de uma janela útil (modelos novos não disparam mensagens sobre pedidos antigos).
- **Sugestões de resposta** só por regras e pelos modelos do próprio usuário (sem IA, sem API paga), que pode desligar.
- **Dar feedback** grava em `feedbacks` (ideia ou "Estou relatando uma falha").
- **Segurança:** autenticação em todas as rotas e no socket (token na primeira mensagem, com a mesma checagem de sessão do banco), 404 para quem não participa, bloqueio em qualquer direção impede envio, limite de taxa nas rotas e no socket (flood derruba a conexão), texto limpo de caracteres de controle e sempre exibido como texto puro (HTML digitado aparece literalmente), origem do socket conferida, logs sem corpo de mensagem.

### Sobre o texto "Ação necessária: não é possível enviar a mensagem"

Esse texto não existe no Dommos (é de outro produto), então não havia o que remover. Quando o envio realmente não é possível (pessoa bloqueada ou conta indisponível), a conversa mostra "Não é possível enviar mensagens nesta conversa" no lugar do campo de texto, e o servidor explica o motivo.

### Também corrigido

- Textos de ajuda e de Privacidade que diziam que pagamentos e mensagens não existiam foram reescritos.
- `/pro/mensagens` agora leva a `/mensagens`; a página de aviso `ProMessages.jsx` foi removida (nenhuma outra referência).
- O cartão "Mensagens não lidas" do painel profissional mostra o número real.

### Pendências da Fase 2 (mensagens)

- Aplicar a migration `20261107200000_messages` no banco real.
- Anexos que não sejam imagem (PDF, etc.) não existem: só fotos.
- Painel para atender denúncias e feedbacks (hoje ficam só no banco: `user_reports` e `feedbacks`).
- Mais de uma instância do servidor exige trocar o estado em memória (presença, "digitando", limite de taxa) por Redis; para uma instância não é necessário.
- Mensagens não passam por moderação automática.

## Rodada 3 / Fase 3: revisão final (concluída)

Verificação: lint sem erros, build sem avisos (bundle principal de 419 kB, antes 832 kB), 48 testes de backend, 7 de frontend, 27 checagens de segurança de API, rastreio de 55 rotas em desktop e celular, mais as suítes de pagamento e mensagens.

### O que o rastreio de rotas conferiu

Visitante (21 rotas), cliente (26) e profissional (8), cada uma em tela de 1366 px e de 390 px: erros de console e de rede, rolagem lateral, `h1`, título da aba, imagens sem `alt`, campos sem rótulo, botões sem nome, textos em inglês e 80 links internos (nenhum leva à página 404). Rotas privadas como visitante vão ao login.

Corrigido nesta rodada:

- **Título e descrição por página**, com `useDocumentMeta` e `RouteTitle`. Anúncio, perfil, artigo de ajuda e pedido aberto definem o próprio título com dados reais.
- **Dados estruturados (schema.org `Service`)** e metadados de compartilhamento na página pública do anúncio, só com informações reais (nota só aparece se houver avaliações).
- **`h1` nos estados de "não encontrado"** (antes a página ficava sem título principal) e na prévia do passo a passo, que tinha dois.
- **Carregamento sob demanda das páginas** (54 páginas): o primeiro carregamento caiu de 832 kB para 419 kB e o aviso de tamanho do build sumiu.
- **Avatares com carregamento tardio**; as fotos dos cartões e galerias já eram tardias.
- Textos de ajuda e de Privacidade que ainda diziam que pagamentos e mensagens não existiam.

Itens que o rastreio apontou mas não são defeitos: os interruptores (nome vem do `<label>` ligado ao botão) e o campo de arquivo do `ImageUploader` (escondido de propósito, com botão visível que faz o papel dele).

### Segurança

- **Autorização:** 27 checagens automáticas. Todas as rotas privadas devolvem 401 sem login; um estranho recebe 404/403 em pedidos, pagamentos, recibos, conversas, modelos de resposta, anúncios e listas de favoritos de outra pessoa, e nada é alterado pelas tentativas. Perfil público, anúncio, busca e pedido não vazam e-mail, telefone, documento nem chave Pix.
- **Limite de taxa novo** em login (10 por 15 min, por IP e e-mail), cadastro, recuperação e redefinição de senha, e login com Google. Já existia em mensagens, pagamentos, denúncias, feedback, contratações e contato.
- **Cabeçalhos de segurança** na API, sem `X-Powered-By`, limite de 100 kB no corpo, e erros de corpo grande ou JSON quebrado agora respondem 413 e 400 (antes davam 500). `TRUST_PROXY` para hospedagens com proxy.
- **Removidas rotas antigas** que a interface não usava mais e eram mais fracas que as novas: `GET/PATCH/DELETE /users/:uuid` (o `DELETE` apagava a conta sem senha nem confirmação), `POST /professionals`, `GET /professionals/search`, `GET/PATCH /professionals/:uuid` e `PATCH /professionals/:uuid/availability`. Antes de apagar, confirmei que nenhum código do frontend nem do backend as chamava. Arquivos apagados: `controllers/userController.js`, `controllers/professionalController.js`, `validators/userValidator.js`, `validators/professionalValidator.js`, `utils/professionalPublication.js` e `tests/professionalPublication.test.js` (testava só o código removido). Ficou `GET /professionals/dashboard`, usado em "Propostas que enviei".
- `frontend/.env` saiu do controle de versão (só tinha o ID público do Google, mas o arquivo constava no `.gitignore`). O `.env.example` agora lista todas as variáveis que o código lê.
- Injeção: texto de ataque SQL na busca devolve resultado vazio sem erro; fotos falsas (HTML com extensão de imagem) e destinos de upload inválidos são recusados.
- CSRF: não se aplica, porque a autenticação é por cabeçalho `Authorization` (nenhum cookie). O preço disso é que o token fica no `localStorage`, exposto a qualquer falha de XSS; não há `dangerouslySetInnerHTML` no código.
- Logs: em produção só registram a mensagem; verifiquei que o log do servidor não contém corpo de mensagem nem chave Pix.

### Documentação

`README.md` na raiz (como rodar, variáveis, como trocar storage, pagamento e tempo real, deploy e hospedagem gratuita) e `frontend/README.md` (antes era o texto padrão do Vite, em inglês). `frontend/public/_redirects` e `_headers` para hospedagens estáticas. `CLAUDE.md` atualizado.

### Pendências da revisão final

- **Pré-visualização em redes sociais:** os metadados são definidos por JavaScript; o Google lê, mas WhatsApp, Facebook e similares normalmente não. Resolver exige renderização no servidor ou pré-renderização, que não foi feita.
- Sem `sitemap.xml` nem `robots.txt`.
- Listas sem paginação: favoritos, notificações e "Meus serviços" (têm limite de itens no servidor, mas sem "próxima página").
- Testes de ponta a ponta (navegador) vivem fora do repositório; o repositório só tem testes de regras e de conteúdo. Vale versionar uma suíte com banco descartável.
- O fluxo de login com Google nunca foi exercitado com credenciais reais.
- Os `RELATORIO_*.md` e `PERSONAL_SETTINGS_*.md` da raiz são históricos e estão desatualizados.
- Cloudinary e SMTP seguem sem teste com contas reais.

## Rodada 4: página do serviço, contratação e identidade visual

Verificação: lint sem erros, build sem avisos (bundle principal de 423 kB; o Leaflet vai num arquivo à parte, carregado só perto do mapa), 53 testes de backend, 52 checagens de API da página e 34 de 35 no navegador (a falha era uma verificação minha sobre a legenda do calendário, que tem rótulo para leitor de tela e não texto visível), 52 pares de cor conferidos no contraste AA. Tudo contra um MariaDB descartável; o banco real não foi tocado.

Também nesta rodada: a página inicial com apresentação (`Landing`) agora é **só para visitantes**; quem está logado vai direto para a busca (modo cliente) ou para o painel (modo profissional). A barra de pesquisa e as abas de categoria só aparecem em `/buscar` e `/servicos`.

### Parte 1: o que já existia e foi aproveitado

Página pública do anúncio, cartão de contratação, pedido, pagamento direto, mensagens e favoritos. Nada foi reescrito do zero: `ListingView` e `BookingCard` foram reorganizados, o resto foi acrescentado. O pagamento direto (Pix, dinheiro, cartão presencial) já existia e foi integrado: o fluxo explica a regra e, depois que o profissional aceita, o cliente paga pela página do pedido.

### Parte 1: o que foi feito

- **Galeria** em grade (1 foto grande e 4 menores), "Mostrar todas as N fotos" com visualizador em tela cheia (setas e Home/End do teclado, Esc, zoom, contador, miniaturas) e carrossel com deslizar e contador no celular.
- **Barra interna fixa** com âncoras (Fotos, O que inclui, Avaliações, Localização), âncora ativa destacada pela rolagem, preço, nota e botão. No celular, **barra fixa embaixo** com preço e "Solicitar".
- **Corpo:** selo de destaque (critérios em um lugar só, `backend/src/utils/highlightRules.js`), linha do profissional, 3 destaques calculados dos dados reais, descrição com "Mostrar mais", "O que esse serviço inclui" e "O que NÃO inclui" (riscados) com modal de todos os itens, calendário de 2 meses, avaliações, "Conheça seu profissional", mapa, "O que você deve saber", carrosséis "Mais serviços do profissional" e "Serviços parecidos", e "Denunciar este anúncio" (grava em `listing_reports`).
- **Calendário:** dias indisponíveis desabilitados, legenda, "Limpar datas" e título dinâmico. **Por hora:** escolhe a data, as horas (1 a 12) e um horário de início entre os livres. **Por diária:** escolhe a data inicial e a final (até 30 dias).
- **Conflitos de verdade no servidor:** pedidos aceitos ocupam horários e dias; um novo pedido que bata recebe 409 ("Este horário acabou de ser ocupado"), e o profissional não consegue aceitar dois pedidos para o mesmo horário. A conta de valor por hora e por diária (valor x quantidade + deslocamento) é a mesma na tela e no servidor, e o pagamento já nasce com o valor certo.
- **Avaliações:** nota média, histograma e "Os clientes mencionam" (assuntos por palavras-chave, só com 2 ou mais citações) calculados dos dados reais; lista em 2 colunas; modal com busca, ordenação (recentes, melhores, piores) e paginação; **o profissional pode responder uma vez** a cada avaliação. Só quem concluiu o serviço avalia (já era regra do servidor, e há teste).
- **Profissional:** anos na plataforma, taxa e tempo médio de resposta (das conversas dos últimos 90 dias; só aparecem com 3 ou mais conversas), selo "Verificado" e botão "Enviar mensagem ao profissional" que abre ou cria a conversa.
- **Mapa gratuito** (OpenStreetMap e Leaflet): mostra o centro da cidade e um círculo com o raio de atendimento, nunca um endereço exato.
- **Fluxo de contratação** em `/anuncios/:uuid/solicitar`: Revisar, Mensagem (com sugestões de perguntas e fotos de referência pelo `ImageUploader`), Pagamento (explica as regras), Confirmar (aceite das regras e da política de cancelamento) e tela de confirmação com o número do pedido, próximos passos e botões "Ver pedido" e "Ir para mensagens". A mensagem do cliente já abre a conversa; visitante passa pelo login e volta ao mesmo ponto; horário ocupado mostra a mensagem e leva de volta ao calendário.
- **SEO:** título e descrição por anúncio, imagem de compartilhamento e dados estruturados `Service` (com `AggregateRating` só quando há avaliações), 404 amigável.
- Migration nova: `20261108100000_service_page` (horário, quantidade, data final e fotos de referência no pedido; resposta na avaliação; denúncias de anúncio).

### Parte 1: o que ficou diferente do pedido ou pendente

- **"Contratar agora" (contratação imediata)** não existe: hoje todo pedido precisa ser aceito pelo profissional, e a página diz isso. Implementar exige um campo novo no anúncio e uma regra de aceite automático.
- **Resumo por critério** (Qualidade, Pontualidade, Comunicação etc.) **foi omitido**: a avaliação guarda uma nota só, então qualquer número por critério seria inventado. O histograma e os assuntos mais citados são reais.
- **Status "pago" no pedido:** o pedido não tem um status "pago". O pagamento tem o próprio status (aguardando, informado, confirmado) e aparece no painel de pagamento do pedido. Cada mudança de status do pedido e do pagamento gera notificação.
- **Por hora só aceita horários cheios** (09:00, 10:00...). Perfil incompleto não bloqueia a contratação (nada além da conta é exigido).
- O mapa precisa de internet para o Nominatim (descobrir a cidade) e para os blocos do OpenStreetMap; se falhar, a página mostra a região por texto. Nominatim e OpenStreetMap têm política de uso justo: para muito tráfego, troque por um provedor próprio.
- Os testes de ponta a ponta de pagamento (`api-pay`) não foram reexecutados depois da mudança do valor por hora, que agora é conhecido na contratação; vale rodá-los antes de publicar.

### Parte 2: cor e degradês

- **Tokens novos** em `frontend/src/index.css`: escalas 50 a 900 da primária (violeta), da secundária (verde-azulado) e do destaque (coral); neutros com toque da primária; semânticas fortes; 12 famílias de categoria (`solid`, `soft` e `ink`); degradês `--gradient-primary`, `-accent`, `-hero`, `-soft`, `-warm` e `-cool`, com direção e paradas definidas num lugar só; brilho de carregamento (`animate-shimmer`). Os nomes antigos (`primary`, `primary-soft`, `ink`...) continuam valendo.
- **Aplicado com critério:** topo da Landing com degradê e busca em destaque; botão principal com degradê sutil (e variantes "suave" e "destaque"); abas e cartões de categoria com a cor de cada categoria; cartões de serviço com chip da categoria, nota em destaque e realce ao passar o mouse; seções da Landing em fundos suaves alternados; avatar sem foto com degradê gerado pelo nome; estados vazios com círculo em degradê suave; carregamento com brilho; barra de progresso do passo a passo e etapa atual do fluxo de contratação com degradê; categorias da Central de Ajuda coloridas; rodapé em degradê suave.
- **Contraste:** `contrast2.mjs` conferiu 52 pares (texto branco sobre as pontas de cada degradê, texto escuro sobre fundos suaves, categoria ink sobre soft, avatar e semânticas): **todos passam de 4,5:1**. Status continuam com texto, nunca só cor. `prefers-reduced-motion` desliga o brilho e os movimentos.
- **Guia de estilo** em `/styleguide`: só existe em desenvolvimento (`npm run dev`); a rota nem entra no build de produção.

### Parte 2: limites

- Conferi a aparência da Landing em desktop e celular (capturas). As demais telas foram conferidas por código, build e contraste, **não uma a uma no navegador** nesta rodada.
- O site não tem modo escuro, então não havia o que manter; os tokens foram pensados só para o tema claro.
- A cor da categoria vem do nome (regras por palavra-chave) e, se não houver regra, do número da categoria. Categorias novas ganham uma cor automática que pode não ser a ideal.
- Alguns pontos continuam com a cor antiga por não serem de atenção (por exemplo, formulários e menus), para a maior parte da tela seguir clara e limpa.
