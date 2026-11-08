/*
 * Artigos da Central de Ajuda. Escreva sempre o que o sistema faz hoje.
 * Blocos do corpo: ['p', texto] · ['h', título] · ['ul', [itens]] · ['ol', [passos]] · ['tip', texto] · ['link', rótulo, caminho]
 */
export const helpArticles = [
  // ---------- Primeiros passos ----------
  {
    slug: 'o-que-e-o-dommos', category: 'primeiros-passos', title: 'O que é o Dommos',
    summary: 'Um lugar para encontrar quem faz o serviço de que você precisa, ou para oferecer o seu trabalho.',
    body: [
      ['p', 'O Dommos conecta pessoas que precisam de um serviço (diarista, eletricista, fotógrafo, aulas e muito mais) a profissionais que oferecem esse trabalho.'],
      ['p', 'Você usa a mesma conta para os dois lados:'],
      ['ul', ['Vou contratar: você busca profissionais, salva favoritos, solicita serviços ou publica pedidos, e avalia depois.', 'Vou trabalhar: você cria anúncios, recebe pedidos, acompanha sua agenda e é avaliado.']],
      ['p', 'Os preços são sempre em reais (R$) e a interface está em português do Brasil.'],
      ['link', 'Explorar serviços', '/buscar'],
    ],
    related: ['criar-conta', 'vou-contratar-e-vou-trabalhar'],
  },
  {
    slug: 'criar-conta', category: 'primeiros-passos', title: 'Como criar sua conta',
    summary: 'Cadastro com e-mail e senha, ou com a sua conta Google.',
    body: [
      ['ol', ['Toque em “Criar conta” no menu do topo.', 'Escolha se quer contratar ou também oferecer serviços. Você pode mudar isso depois.', 'Informe nome, sobrenome, e-mail e uma senha com pelo menos 8 caracteres, ou continue com o Google.', 'Pronto: você já entra na sua conta.']],
      ['p', 'Depois de criar a conta, confirme seu e-mail e seu telefone em Configurações da conta > Informações pessoais. A confirmação é feita com um código de 6 dígitos que vale por 10 minutos.'],
      ['tip', 'Use um e-mail que você acessa com frequência: é por ele que enviamos o link de recuperação de senha.'],
    ],
    related: ['completar-perfil', 'esqueci-minha-senha'],
  },
  {
    slug: 'vou-contratar-e-vou-trabalhar', category: 'primeiros-passos', title: 'Vou contratar e Vou trabalhar',
    summary: 'O botão do topo alterna entre as duas formas de usar a conta.',
    body: [
      ['p', 'No topo da página há um botão. Quando você está no modo cliente, ele mostra “Vou trabalhar”; no modo profissional, mostra “Vou contratar”.'],
      ['ul', ['Se você ainda não oferece serviços, “Vou trabalhar” leva ao passo a passo para criar seu primeiro anúncio.', 'Se já é profissional, ele abre a área do profissional, com painel, pedidos, agenda e seus serviços.', 'Sua escolha fica guardada neste navegador, por conta.']],
      ['p', 'O cabeçalho continua o mesmo nos dois modos: o que muda é o conteúdo da página.'],
    ],
    related: ['comecar-a-oferecer-servicos', 'buscar-profissionais'],
  },
  {
    slug: 'pedido-por-anuncio-e-pedido-aberto', category: 'contratar', title: 'Pedido por anúncio e pedido aberto',
    summary: 'Dois jeitos de contratar: escolher um serviço pronto de um profissional ou descrever o que você precisa e receber propostas.',
    body: [
      ['h', 'Pedido por anúncio'],
      ['p', 'Você escolhe um serviço específico de um profissional e solicita ou contrata. O profissional vê o pedido em "Pedidos recebidos", no painel dele, e aceita ou recusa.'],
      ['h', 'Pedido aberto'],
      ['p', 'Você não escolhe um anúncio: descreve o que precisa ("Publicar um pedido") e os profissionais enviam propostas com valor e prazo. Você compara, escolhe uma e segue para o pagamento. O profissional vê os pedidos abertos em "Oportunidades".'],
      ['tip', 'Nos dois casos, depois que a proposta ou o pedido é aceito, o fluxo é o mesmo: pagamento, execução, conclusão e avaliação.'],
      ['link', 'Publicar um pedido', '/servicos/novo'],
    ],
    related: ['publicar-um-pedido', 'solicitar-um-servico'],
  },
  {
    slug: 'completar-perfil', category: 'primeiros-passos', title: 'Como completar seu perfil',
    summary: 'Foto, apresentação e outras informações ajudam as pessoas a confiarem em você.',
    body: [
      ['ol', ['Abra o menu e escolha “Perfil”.', 'Toque em “Editar” (ou em “Preencher agora”).', 'Envie uma foto, escreva a seção “Sobre mim” e preencha cidade, profissão, idiomas, habilidades e interesses.', 'Toque em “Concluído” para salvar.']],
      ['p', 'Todos os campos são opcionais. Seu e-mail, telefone e endereço nunca aparecem no perfil público. Quem pode ver o resto do perfil você define em Configurações da conta > Privacidade.'],
      ['link', 'Editar meu perfil', '/perfil/editar'],
    ],
    related: ['privacidade-do-perfil', 'criar-conta'],
  },
  {
    slug: 'idioma-e-moeda', category: 'primeiros-passos', title: 'Idioma e moeda',
    summary: 'Hoje o Dommos funciona em português do Brasil e em reais.',
    body: [
      ['p', 'Por enquanto existe apenas uma opção de idioma, Português (Brasil), e uma de moeda, Real brasileiro (BRL). Para ver isso, abra o menu e escolha “Idioma e moeda”.'],
      ['p', 'A estrutura já está pronta para receber outros idiomas e moedas no futuro. Quando isso acontecer, as opções aparecerão nesse mesmo lugar.'],
    ],
    related: ['o-que-e-o-dommos'],
  },

  // ---------- Contratar um serviço ----------
  {
    slug: 'buscar-profissionais', category: 'contratar', title: 'Como buscar profissionais',
    summary: 'Use a busca do topo, as abas de categoria e os filtros.',
    body: [
      ['p', 'A barra de busca tem três campos, todos opcionais: Onde (cidade), Quando (data) e Que tipo de serviço. Você pode preencher só o que importa para você.'],
      ['ul', ['As abas abaixo da barra filtram por categoria, como Elétrica ou Aulas.', 'Em “Filtros” você limita o preço, a nota mínima e a forma de atendimento.', 'Em “Ordenar por” você escolhe entre melhor avaliação, menor preço e mais recentes.']],
      ['p', 'Toque no coração de um anúncio para salvá-lo nos favoritos e comparar depois.'],
      ['link', 'Buscar agora', '/buscar'],
    ],
    related: ['favoritos-e-listas', 'solicitar-um-servico'],
  },
  {
    slug: 'solicitar-um-servico', category: 'contratar', title: 'Como solicitar um serviço',
    summary: 'Escolha a data, o pacote e envie o pedido ao profissional.',
    body: [
      ['ol', ['Abra o anúncio do serviço que você quer.', 'No cartão de contratação, escolha a data e, se houver, o pacote.', 'Escreva observações: endereço aproximado, o que precisa ser feito, horários que funcionam.', 'Toque em “Solicitar serviço”.']],
      ['p', 'O profissional recebe um aviso e pode aceitar ou recusar. Você acompanha tudo em Pedidos e contratações; o status começa em “Aguardando resposta”.'],
      ['tip', 'A data precisa respeitar os dias de atendimento e a antecedência mínima que o profissional definiu no anúncio.'],
    ],
    related: ['acompanhar-pedidos', 'cancelar-um-pedido-ou-contratacao'],
  },
  {
    slug: 'publicar-um-pedido', category: 'contratar', title: 'Publicar um pedido aberto',
    summary: 'Não achou ninguém? Descreva o que precisa e receba propostas.',
    body: [
      ['p', 'Um pedido aberto é um anúncio seu: você descreve o que precisa e profissionais respondem com propostas de preço e prazo.'],
      ['ol', ['Abra “Pedidos e contratações” e toque em “Publicar pedido”.', 'Informe título, descrição (mínimo de 20 caracteres), categoria, faixa de orçamento e prazo.', 'Se quiser, adicione fotos: a primeira é a capa.', 'Publique e aguarde as propostas.']],
      ['p', 'Ao receber propostas, você vê o perfil de cada profissional e aceita uma. As outras propostas pendentes são recusadas automaticamente e o serviço passa a “Em andamento”.'],
    ],
    related: ['acompanhar-pedidos', 'avaliar-um-servico'],
  },
  {
    slug: 'acompanhar-pedidos', category: 'contratar', title: 'Acompanhar pedidos e contratações',
    summary: 'Entenda cada status.',
    body: [
      ['p', 'Em Pedidos e contratações você vê suas solicitações a profissionais e seus pedidos abertos. Os status são:'],
      ['ul', ['Aguardando resposta: o profissional ainda não respondeu.', 'Aceito: o profissional confirmou a data.', 'Em andamento: o serviço começou.', 'Concluído: o serviço terminou e a avaliação foi liberada.', 'Recusado: o profissional não pôde atender.', 'Cancelado: foi cancelado por você ou pelo profissional.']],
      ['p', 'Cada mudança gera uma notificação no sino do topo. Você escolhe se também quer receber por e-mail em Configurações > Notificações.'],
      ['link', 'Ver meus pedidos', '/meus-servicos'],
    ],
    related: ['notificacoes', 'cancelar-um-pedido-ou-contratacao'],
  },
  {
    slug: 'avaliar-um-servico', category: 'contratar', title: 'Como avaliar um serviço',
    summary: 'A avaliação é liberada quando o serviço é concluído.',
    body: [
      ['p', 'Depois que o serviço fica “Concluído”, cliente e profissional podem se avaliar. Você recebe uma notificação com o link.'],
      ['ul', ['A nota vai de 1 a 5.', 'O comentário é opcional; se escrever, use pelo menos 10 caracteres.', 'Cada pessoa avalia uma vez por serviço.']],
      ['p', 'As avaliações aparecem no perfil de quem foi avaliado. Você vê as que escreveu em Perfil > “Mostrar avaliações que escrevi” e escolhe, em Privacidade, se elas aparecem no seu perfil público.'],
    ],
    related: ['avaliacoes-honestas', 'acompanhar-pedidos'],
  },
  {
    slug: 'favoritos-e-listas', category: 'contratar', title: 'Favoritos e listas',
    summary: 'Salve profissionais e organize em listas.',
    body: [
      ['p', 'Toque no coração em qualquer cartão para escolher em quais listas salvar. Se você ainda não tem listas, criamos a lista “Favoritos” para começar.'],
      ['ul', ['Crie listas por assunto, como “Eletricista” ou “Fotografia”.', 'Renomeie ou exclua uma lista quando quiser; excluir uma lista não apaga o profissional.', 'A lista “Vistos recentemente” é automática e guarda os últimos perfis que você abriu.']],
      ['link', 'Abrir meus favoritos', '/favoritos'],
    ],
    related: ['buscar-profissionais'],
  },

  // ---------- Ser profissional ----------
  {
    slug: 'comecar-a-oferecer-servicos', category: 'profissional', title: 'Como começar a oferecer serviços',
    summary: 'Um passo a passo guiado cria o seu primeiro anúncio.',
    body: [
      ['p', 'Toque em “Vou trabalhar”. Se você ainda não tem anúncios, começa o passo a passo, com uma tela por etapa e barra de progresso:'],
      ['ol', ['Categoria e tipo de serviço', 'Como você atende (na casa do cliente, no seu local ou online)', 'Cidade e raio de atendimento', 'Título e descrição', 'Fotos (no mínimo 3)', 'O que está incluso, o que não está incluso, requisitos e materiais', 'Preço', 'Disponibilidade e política de cancelamento', 'Seus dados de verificação', 'Revisão e publicação']],
      ['p', 'Use “Salvar e sair” a qualquer momento: o rascunho fica guardado e você continua de onde parou. Só aparece nas buscas depois de publicado.'],
    ],
    related: ['criar-um-bom-anuncio', 'verificacao-do-profissional'],
  },
  {
    slug: 'criar-um-bom-anuncio', category: 'profissional', title: 'Dicas para um bom anúncio',
    summary: 'Pequenos cuidados que ajudam a receber mais pedidos.',
    body: [
      ['ul', ['Título claro: diga o serviço e o diferencial. “Instalação de chuveiro elétrico com garantia” funciona melhor que “Serviços elétricos”.', 'Descrição honesta: conte como é o seu trabalho, a sua experiência e o que o cliente precisa deixar pronto.', 'Boas fotos: use luz natural, mostre trabalhos reais e escolha como capa a melhor delas.', 'Incluso e não incluso: deixe claro se o material está no preço, para evitar surpresas.', 'Preço transparente: informe o modelo de cobrança e a taxa de deslocamento, se houver.']],
      ['tip', 'Você pode editar o anúncio a qualquer momento. As mudanças valem assim que você avança de etapa, e o anúncio continua publicado.'],
    ],
    related: ['precos-e-pacotes', 'comecar-a-oferecer-servicos'],
  },
  {
    slug: 'pedidos-e-agenda', category: 'profissional', title: 'Receber pedidos e usar a agenda',
    summary: 'Aceite, inicie e conclua serviços, e bloqueie datas em que não pode atender.',
    body: [
      ['p', 'Em Vou trabalhar > Pedidos e agenda você vê os pedidos recebidos por status.'],
      ['ul', ['Novo pedido: aceite ou recuse.', 'Aceito: quando for a hora, inicie o serviço.', 'Em andamento: ao terminar, marque como concluído para liberar as avaliações.']],
      ['p', 'No calendário você bloqueia os dias em que não atende. Esses dias deixam de aparecer como disponíveis para os clientes. Os serviços aceitos aparecem marcados na data combinada.'],
    ],
    related: ['cancelar-um-pedido-ou-contratacao', 'enviar-propostas'],
  },
  {
    slug: 'precos-e-pacotes', category: 'profissional', title: 'Preços, deslocamento e pacotes',
    summary: 'Escolha como cobrar e quanto você recebe.',
    body: [
      ['p', 'O modelo de preço pode ser por hora, por diária, por projeto (valor fechado) ou sob consulta. Os valores são sempre em reais.'],
      ['ul', ['Taxa de deslocamento: opcional, somada ao valor quando o atendimento é na casa do cliente.', 'Pacotes: até dois (por exemplo, Básico e Completo) com nome, valor e descrição.', 'Taxa da plataforma: hoje é 0%, então você recebe o valor integral. Mostramos esse cálculo no passo de preço, e ele acompanhará qualquer mudança futura.']],
      ['p', 'No modelo “sob consulta” não há valor público: o cliente combina com você depois de solicitar.'],
    ],
    related: ['taxas-da-plataforma', 'como-funciona-o-pagamento'],
  },
  {
    slug: 'verificacao-do-profissional', category: 'profissional', title: 'Verificação do profissional',
    summary: 'Como funciona o selo “Verificado”.',
    body: [
      ['p', 'No passo de verificação, você informa seu CPF ou CNPJ e o nome completo (ou razão social). Conferimos se os dígitos do documento estão corretos.'],
      ['p', 'O selo “Verificado” só aparece depois de uma análise manual dos seus dados pela equipe. Até lá, o seu status fica “Em análise”, e você já pode publicar anúncios normalmente.'],
      ['tip', 'Por enquanto não pedimos foto de documento. Quando pedirmos, o envio será feito em área privada, que não aparece para outras pessoas.'],
      ['link', 'Dados de impostos e recebimento', '/configuracoes/impostos'],
    ],
    related: ['impostos-e-recebimento', 'comecar-a-oferecer-servicos'],
  },
  {
    slug: 'enviar-propostas', category: 'profissional', title: 'Enviar propostas a pedidos abertos',
    summary: 'Responda a clientes que publicaram o que precisam.',
    body: [
      ['ol', ['Abra “Pedidos abertos” e escolha um pedido.', 'Toque em “Enviar proposta”.', 'Informe o valor, o prazo (opcional) e uma apresentação. Se escrever a apresentação, use pelo menos 20 caracteres.']],
      ['p', 'Você acompanha suas propostas em Pedidos e agenda. Se o cliente aceitar, o serviço passa a “Em andamento”; se aceitar outra proposta, a sua é marcada como recusada.'],
      ['p', 'Você só pode enviar uma proposta por pedido, e não pode responder a pedidos de quem bloqueou você.'],
      ['link', 'Ver oportunidades', '/pro/oportunidades'],
    ],
    related: ['publicar-um-pedido', 'pedidos-e-agenda'],
  },
  {
    slug: 'pausar-ou-editar-anuncio', category: 'profissional', title: 'Editar, pausar, duplicar e excluir anúncios',
    summary: 'Gerencie seus serviços em Vou trabalhar > Meus serviços.',
    body: [
      ['ul', ['Editar: abre o mesmo passo a passo, já preenchido.', 'Pausar: o anúncio deixa de aparecer na busca, mas não é apagado. Você publica de novo quando quiser.', 'Duplicar: cria um rascunho a partir de um anúncio, útil para serviços parecidos.', 'Excluir: remove o anúncio, depois de uma confirmação.']],
      ['p', 'Pedidos já aceitos continuam valendo se você pausar o anúncio. Não é possível excluir um anúncio que tenha pedido em aberto ou em andamento: conclua ou cancele esses pedidos antes.'],
    ],
    related: ['criar-um-bom-anuncio'],
  },

  // ---------- Pagamentos ----------
  {
    slug: 'como-funciona-o-pagamento', category: 'pagamentos', title: 'Como funciona o pagamento',
    summary: 'Pagamento direto entre as partes, sem custo e sem intermediário.',
    body: [
      ['p', 'O Dommos está em modo gratuito: o dinheiro não passa pela plataforma. Depois que o profissional aceita o pedido, o cliente escolhe como pagar (Pix, dinheiro ou cartão na maquininha, presencialmente), entre as formas que o profissional aceita.'],
      ['ul', ['No Pix, o pedido mostra o valor, a chave, um QR Code e o “copia e cola”. Pague no app do seu banco e toque em “Já paguei”.', 'O profissional confere o recebimento e toca em “Confirmar recebimento”. Só então o recibo fica disponível.', 'Se o profissional não encontrar o pagamento, ele avisa e você informa de novo.']],
      ['p', 'O Dommos não retém valores, não faz reembolsos e não garante pagamentos. Estornos são combinados e feitos direto entre as partes; o Dommos só registra.'],
      ['ul', ['Combine o valor e o que está incluso antes de o serviço começar.', 'Desconfie de quem pedir pagamento adiantado ou fora do pedido.', 'Configure como você recebe em Configurações da conta > Pagamentos.']],
    ],
    related: ['pagamento-seguro-dicas', 'reembolsos'],
  },
  {
    slug: 'impostos-e-recebimento', category: 'pagamentos', title: 'Impostos e dados de recebimento',
    summary: 'Onde informar CPF ou CNPJ e chave Pix (só para profissionais).',
    body: [
      ['p', 'Quem tem perfil profissional vê a seção Impostos em Configurações da conta. Nela você informa o CPF ou CNPJ, o nome completo (ou razão social) e, se quiser, uma chave Pix.'],
      ['ul', ['Os dados aparecem mascarados na tela, e nunca no seu perfil público.', 'Conferimos os dígitos do documento, mas isso não comprova que ele é seu.', 'Ainda não há repasses pelo Dommos, então a chave Pix fica apenas guardada.']],
      ['p', 'Você pode alterar ou remover esses dados a qualquer momento.'],
      ['link', 'Abrir Impostos', '/configuracoes/impostos'],
    ],
    related: ['verificacao-do-profissional', 'como-funciona-o-pagamento'],
  },
  {
    slug: 'taxas-da-plataforma', category: 'pagamentos', title: 'Taxas da plataforma',
    summary: 'Hoje o Dommos não cobra taxa.',
    body: [
      ['p', 'A taxa da plataforma é de 0%: o valor combinado é o valor que o profissional recebe. O sistema já tem essa taxa como configuração; se ela mudar, o cálculo no passo de preço do anúncio mostrará quanto você recebe antes de publicar.'],
      ['p', 'Criar conta, publicar anúncios e solicitar serviços são gratuitos.'],
    ],
    related: ['precos-e-pacotes'],
  },
  {
    slug: 'pagamento-seguro-dicas', category: 'pagamentos', title: 'Dicas para negociar com segurança',
    summary: 'Cuidados simples evitam problemas.',
    body: [
      ['ul', ['Converse e combine tudo antes: valor, data, o que está incluso e quem compra o material.', 'Prefira pagar pela parte concluída em vez de tudo adiantado.', 'Peça um comprovante e guarde as informações do pedido.', 'Não compartilhe senhas nem códigos de verificação com ninguém; o Dommos nunca pede esses dados.', 'Se algo parecer errado, fale com o suporte.']],
      ['link', 'Falar com o suporte', '/ajuda/contato'],
    ],
    related: ['como-funciona-o-pagamento', 'regras-da-comunidade'],
  },

  // ---------- Mensagens ----------
  {
    slug: 'mensagens-no-dommos', category: 'mensagens', title: 'Mensagens entre clientes e profissionais',
    summary: 'Converse com clientes e profissionais, em tempo real.',
    body: [
      ['p', 'Toque em “Enviar mensagem” na página de um serviço, ou em “Conversar” dentro de um pedido. A conversa fica ligada àquele serviço e aparece em Mensagens, com busca, contador de não lidas e indicador de “digitando”.'],
      ['ul', ['Você pode enviar texto e uma foto por mensagem.', 'Profissionais criam respostas rápidas, com variáveis como {nome_do_cliente} e {servico}, e podem programar o envio antes ou depois do serviço.', 'Conversas arquivadas ficam em “Conversas anteriores”. Uma mensagem nova traz a conversa de volta.', 'Se você estiver fora do Dommos, pode receber um e-mail (no máximo um a cada 30 minutos por conversa). Isso se ajusta em Notificações.', 'Para denunciar ou bloquear alguém, use o menu ⋯ da conversa.']],
      ['p', 'Combine o pagamento e o serviço pelo pedido. Desconfie de quem quiser levar a conversa para fora da plataforma ou pedir dinheiro adiantado.'],
    ],
    related: ['notificacoes', 'solicitar-um-servico'],
  },
  {
    slug: 'notificacoes', category: 'mensagens', title: 'Notificações',
    summary: 'Escolha o que receber, no site e por e-mail.',
    body: [
      ['p', 'Você recebe avisos quando chega uma proposta, uma proposta é aceita, um pedido de contratação chega ou muda de status, um serviço é concluído e quando alguém avalia você.'],
      ['ul', ['No site: aparecem no sino do topo e em Notificações.', 'Por e-mail: enviados ao e-mail da sua conta, quando o envio de e-mails está ativo.']],
      ['p', 'Em Configurações da conta > Notificações, cada tipo tem um interruptor para cada canal. As escolhas são salvas na hora e valem para os próximos avisos. Não há notificações push nem por WhatsApp.'],
      ['link', 'Ajustar notificações', '/configuracoes/notificacoes'],
    ],
    related: ['acompanhar-pedidos'],
  },
  {
    slug: 'confirmacao-de-leitura', category: 'mensagens', title: 'Confirmação de leitura',
    summary: 'Escolha se a outra pessoa vê que você leu a mensagem.',
    body: [
      ['p', 'Em Privacidade você escolhe se quer mostrar que leu uma mensagem. Com a opção ligada, a outra pessoa vê “Visto” nas mensagens que você leu. Se você desligar, também deixa de ver o “Visto” dos outros. O contador de não lidas continua funcionando.'],
      ['link', 'Abrir Privacidade', '/configuracoes/privacidade'],
    ],
    related: ['mensagens-no-dommos', 'privacidade-do-perfil'],
  },
  {
    slug: 'bloquear-uma-pessoa', category: 'mensagens', title: 'Bloquear e desbloquear pessoas',
    summary: 'Pare de interagir com quem você não quer.',
    body: [
      ['p', 'Abra o perfil da pessoa e toque em “Bloquear esta pessoa”. Depois do bloqueio:'],
      ['ul', ['Ela não consegue ver o seu perfil.', 'Ela não consegue enviar propostas aos seus pedidos nem solicitar seus serviços.', 'Ela não aparece nos seus favoritos nem nas suas conexões.']],
      ['p', 'Você vê e desfaz seus bloqueios em Configurações da conta > Privacidade > Pessoas bloqueadas. A outra pessoa não é avisada.'],
    ],
    related: ['regras-da-comunidade', 'privacidade-do-perfil'],
  },

  // ---------- Conta e segurança ----------
  {
    slug: 'alterar-ou-criar-senha', category: 'conta', title: 'Alterar ou criar senha',
    summary: 'Em Login e segurança.',
    body: [
      ['ol', ['Abra Configurações da conta > Login e segurança.', 'Em “Alterar senha”, informe a senha atual e a nova (mínimo de 8 caracteres).', 'Confirme e salve.']],
      ['p', 'Ao trocar a senha, os outros dispositivos conectados são desconectados. Se você entrou só com o Google e nunca criou senha, a mesma tela permite criar uma, sem pedir a senha atual.'],
    ],
    related: ['dispositivos-e-sessoes', 'login-com-google'],
  },
  {
    slug: 'esqueci-minha-senha', category: 'conta', title: 'Esqueci minha senha',
    summary: 'Receba um link para criar uma nova.',
    body: [
      ['ol', ['Na tela de entrada, toque em “Esqueceu sua senha?”.', 'Informe o e-mail da conta.', 'Abra o e-mail e use o link para criar a nova senha.']],
      ['p', 'O link vale por 30 minutos e só pode ser usado uma vez. Se não chegar, confira a caixa de spam. Por segurança, a mensagem na tela é a mesma exista ou não uma conta com aquele e-mail.'],
      ['link', 'Recuperar senha', '/forgot-password'],
    ],
    related: ['alterar-ou-criar-senha'],
  },
  {
    slug: 'dispositivos-e-sessoes', category: 'conta', title: 'Dispositivos conectados',
    summary: 'Veja onde sua conta está aberta e desconecte quando quiser.',
    body: [
      ['p', 'Em Login e segurança, a lista “Onde você está conectado” mostra cada sessão aberta: navegador, sistema, parte da rede e o último acesso. O dispositivo atual vem marcado.'],
      ['ul', ['“Sair da conta” em uma linha encerra aquela sessão na hora.', '“Sair de todos os outros dispositivos” encerra todas, menos a atual.']],
      ['tip', 'Se você não reconhece algum dispositivo, desconecte e troque a senha.'],
    ],
    related: ['alterar-ou-criar-senha'],
  },
  {
    slug: 'login-com-google', category: 'conta', title: 'Entrar com o Google',
    summary: 'Conecte ou desconecte a sua conta Google.',
    body: [
      ['p', 'Em Login e segurança > Contas sociais você conecta o Google à sua conta. Depois, pode entrar só com um toque.'],
      ['p', 'Para não perder o acesso, só é possível desconectar o Google se a conta tiver uma senha. Se não tiver, crie uma antes na mesma página.'],
    ],
    related: ['alterar-ou-criar-senha'],
  },
  {
    slug: 'privacidade-do-perfil', category: 'conta', title: 'Privacidade do perfil',
    summary: 'Defina quem vê suas informações.',
    body: [
      ['p', 'Em Configurações da conta > Privacidade você escolhe:'],
      ['ul', ['Quem pode ver o perfil: todas as pessoas, só quem tem conta ou só suas conexões. Quem não pode vê apenas seu nome e foto.', 'Aparecer na busca: desligue para seus anúncios e perfil profissional saírem dos resultados do Dommos.', 'Avaliações que escrevi: escolha se elas aparecem no seu perfil público.', 'Cookies: essenciais ficam sempre ativos; análise e marketing são opcionais.']],
      ['p', 'Conexões são as pessoas com quem você já fechou negócio. E-mail, telefone e endereço nunca aparecem no perfil público.'],
    ],
    related: ['bloquear-uma-pessoa', 'meus-dados-lgpd'],
  },
  {
    slug: 'desativar-ou-excluir-conta', category: 'conta', title: 'Desativar ou excluir a conta',
    summary: 'A diferença entre pausar e apagar.',
    body: [
      ['h', 'Desativar (temporário)'],
      ['p', 'Seu perfil, seus anúncios e seus pedidos deixam de aparecer e você é desconectado de todos os dispositivos. Para reativar, basta entrar de novo. Fica em Login e segurança.'],
      ['h', 'Excluir (definitivo)'],
      ['p', 'Fica em Privacidade e tem duas etapas: confirmar a senha e digitar a palavra EXCLUIR. Os dados pessoais, as fotos, os favoritos e as notificações são apagados, e seu nome deixa de aparecer nas avaliações guardadas por outras pessoas. Pedidos abertos são cancelados.'],
      ['tip', 'Não é possível excluir a conta enquanto houver serviço em andamento. Conclua ou cancele antes.'],
    ],
    related: ['meus-dados-lgpd', 'dispositivos-e-sessoes'],
  },
  {
    slug: 'meus-dados-lgpd', category: 'conta', title: 'Seus dados e a LGPD',
    summary: 'Baixe uma cópia dos seus dados e conheça seus direitos.',
    body: [
      ['p', 'Em Privacidade > “Meus dados pessoais” você baixa uma cópia do que o Dommos guarda sobre você, em JSON ou CSV: conta, perfil, pedidos, propostas, avaliações, favoritos, chamados, notificações e sessões. Senhas não são incluídas.'],
      ['p', 'Você também pode corrigir seus dados em Informações pessoais e excluir a conta. Para outras solicitações sobre dados pessoais, fale com o suporte.'],
      ['link', 'Ler a Política de privacidade', '/politica-de-privacidade'],
    ],
    related: ['desativar-ou-excluir-conta', 'privacidade-do-perfil'],
  },

  // ---------- Cancelamentos e reembolsos ----------
  {
    slug: 'cancelar-um-pedido-ou-contratacao', category: 'cancelamentos', title: 'Como cancelar',
    summary: 'Quem pode cancelar e em qual momento.',
    body: [
      ['ul', ['Cliente: pode cancelar uma solicitação enquanto ela estiver aguardando resposta, aceita ou em andamento.', 'Profissional: pode recusar um pedido novo e cancelar um pedido aceito ou em andamento.', 'Pedido aberto: o cliente pode cancelar enquanto não estiver concluído; as propostas pendentes são recusadas.']],
      ['p', 'Depois de concluído ou cancelado, o pedido não pode mudar de status. A outra pessoa recebe uma notificação.'],
      ['tip', 'Cancele o quanto antes: respeitar a política de cancelamento do anúncio evita desentendimentos.'],
    ],
    related: ['politicas-de-cancelamento', 'reembolsos'],
  },
  {
    slug: 'politicas-de-cancelamento', category: 'cancelamentos', title: 'Políticas de cancelamento',
    summary: 'Flexível, moderada ou rígida: o profissional escolhe.',
    body: [
      ['p', 'Cada anúncio mostra a política de cancelamento escolhida pelo profissional:'],
      ['ul', ['Flexível: cancelamento sem custo até 24 horas antes da data combinada.', 'Moderada: cancelamento sem custo até 72 horas antes.', 'Rígida: cancelamento sem custo até 7 dias antes.']],
      ['p', 'Como o pagamento é combinado direto entre as partes, a política é um acordo entre elas: ela indica o que o profissional espera. Eventuais compensações são combinadas diretamente.'],
      ['link', 'Ler a Política de cancelamento', '/politica-de-cancelamento'],
    ],
    related: ['cancelar-um-pedido-ou-contratacao', 'reembolsos'],
  },
  {
    slug: 'reembolsos', category: 'cancelamentos', title: 'Reembolsos',
    summary: 'O Dommos não intermedia reembolsos.',
    body: [
      ['p', 'Como o pagamento é combinado diretamente entre cliente e profissional, o Dommos não recebe nem devolve valores. Qualquer reembolso deve ser acertado entre vocês.'],
      ['ul', ['Se o serviço foi cancelado, converse com a outra parte e consulte a política do anúncio.', 'Se não houver acordo, registre um chamado com o contexto: o Dommos guarda o seu relato.']],
      ['link', 'Falar com o suporte', '/ajuda/contato'],
    ],
    related: ['politicas-de-cancelamento', 'como-funciona-o-pagamento'],
  },
  {
    slug: 'profissional-nao-compareceu', category: 'cancelamentos', title: 'O profissional (ou cliente) não compareceu',
    summary: 'O que fazer quando o combinado não acontece.',
    body: [
      ['ol', ['Tente contato pelos meios combinados.', 'Se o serviço estiver “Aceito” ou “Em andamento”, cancele o pedido na página dele.', 'Registre um chamado em “Falar com o suporte”, com data, nome e o que aconteceu.', 'Depois, avalie com honestidade, se o serviço chegou a ser concluído.']],
      ['p', 'Os chamados ficam salvos em Central de Ajuda > Meus chamados.'],
    ],
    related: ['cancelar-um-pedido-ou-contratacao', 'avaliacoes-honestas'],
  },

  // ---------- Regras da comunidade ----------
  {
    slug: 'regras-da-comunidade', category: 'comunidade', title: 'Regras da comunidade',
    summary: 'Respeito e honestidade são a base.',
    body: [
      ['ul', ['Trate todas as pessoas com respeito, sem ofensas, discriminação ou assédio.', 'Informe dados verdadeiros no perfil e nos anúncios.', 'Cumpra o que foi combinado: datas, valores e o que está incluso.', 'Proteja seus dados e os dos outros: não compartilhe documentos, senhas ou códigos.', 'Use o Dommos só para serviços lícitos.']],
      ['p', 'Quem descumprir as regras pode ter anúncios removidos ou a conta limitada.'],
    ],
    related: ['conteudo-proibido', 'denunciar-um-problema'],
  },
  {
    slug: 'conteudo-proibido', category: 'comunidade', title: 'Conteúdo e serviços proibidos',
    summary: 'O que não pode ser anunciado ou publicado.',
    body: [
      ['ul', ['Serviços ilegais ou que ofereçam risco à segurança de alguém.', 'Conteúdo ofensivo, violento ou sexual.', 'Fotos que não são suas ou que mostrem outras pessoas sem autorização.', 'Anúncios enganosos, com preços ou qualificações falsas.', 'Spam e tentativas de golpe.']],
      ['p', 'As fotos enviadas precisam ser JPG, PNG ou WebP, com até 5 MB.'],
    ],
    related: ['regras-da-comunidade'],
  },
  {
    slug: 'avaliacoes-honestas', category: 'comunidade', title: 'Avaliações honestas',
    summary: 'Avalie o que você viveu.',
    body: [
      ['ul', ['Só é possível avaliar serviços concluídos.', 'Descreva a sua experiência, sem ofensas.', 'Não combine notas com a outra pessoa.']],
      ['p', 'Cada pessoa avalia uma vez por serviço. Se você achar uma avaliação injusta ou abusiva, fale com o suporte.'],
    ],
    related: ['avaliar-um-servico', 'denunciar-um-problema'],
  },
  {
    slug: 'denunciar-um-problema', category: 'comunidade', title: 'Como relatar um problema',
    summary: 'Use o formulário de suporte.',
    body: [
      ['p', 'Se você viu um anúncio, perfil ou comportamento que desrespeita as regras, conte para a gente em “Falar com o suporte”, escolhendo o assunto “Regras da comunidade”. Inclua o endereço da página e o que aconteceu.'],
      ['p', 'Enquanto isso, você pode bloquear a pessoa para não receber mais contatos dela.'],
      ['link', 'Falar com o suporte', '/ajuda/contato'],
    ],
    related: ['bloquear-uma-pessoa', 'regras-da-comunidade'],
  },
];

export const helpArticleBySlug = Object.fromEntries(helpArticles.map((article) => [article.slug, article]));
