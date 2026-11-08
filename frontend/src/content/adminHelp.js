// Textos de ajuda da área do administrador, em linguagem simples.
export const SECTIONS = {
  resumo: {
    title: 'Resumo',
    what: 'Uma visão rápida de como estão os pagamentos feitos pelo Dommos e do que está esperando uma ação sua.',
    todo: 'Olhe os números que pedem atenção (reclamações abertas, alertas e avisos com falha) e abra a seção correspondente.',
    help: 'Os valores de dinheiro somam só pagamentos pelo Dommos (Pix, cartão e boleto). Pagamentos combinados direto entre as partes não aparecem aqui.',
  },
  transacoes: {
    title: 'Transações e comissões',
    what: 'Todos os pagamentos feitos pelo Dommos, com o valor pago, a comissão que ficou para a plataforma e o que foi estornado.',
    todo: 'Escolha o período e confira os totais. Use "Exportar CSV" para abrir no Excel ou enviar ao contador.',
    help: 'Comissão é o que o Dommos retém: a comissão cobrada do profissional somada à taxa de serviço do cliente, quando houver. Pagamentos estornados não contam como comissão.',
  },
  reclamacoes: {
    title: 'Reclamações',
    what: 'São pedidos em que o cliente disse que o serviço não foi feito como combinado, antes de o valor ser liberado ao profissional. Enquanto a reclamação está aberta, o dinheiro fica parado.',
    todo: 'Leia o motivo, converse com as partes se precisar e decida: reembolsar o cliente (total ou parte) ou manter o pagamento ao profissional. A justificativa é obrigatória e as duas partes são avisadas.',
    help: 'Quanto mais tempo aberta, pior para os dois lados: o cliente espera o dinheiro e o profissional espera o repasse. Tente decidir em poucos dias.',
  },
  alertas: {
    title: 'Alertas',
    what: 'Problemas que o sistema detectou e que podem precisar de você: dinheiro que não chegou, contestação de cartão, avisos do gateway que falharam e outros.',
    todo: 'Comece pelos de gravidade alta. Siga a ação sugerida em cada alerta e, quando resolver, marque como resolvido com uma nota do que foi feito.',
    help: 'Alguns alertas somem sozinhos quando o problema acaba (por exemplo, um pagamento pendente que foi pago). Os outros ficam abertos até você marcar como resolvido, e o histórico fica guardado.',
  },
  webhooks: {
    title: 'Avisos do gateway (webhooks)',
    what: 'O Asaas, que processa os pagamentos, avisa o Dommos a cada mudança (pago, estornado, cancelado...). Aqui estão esses avisos e o que o sistema fez com cada um.',
    todo: 'Normalmente não é preciso fazer nada. Olhe só os "Com falha": se um aviso falhou, o pagamento pode estar desatualizado.',
    help: '"Ignorado" não é erro: o Asaas manda muitos avisos que o Dommos não usa, como "o cliente abriu a página de pagamento". Eles aparecem só para você ter o registro.',
  },
  auditoria: {
    title: 'Auditoria',
    what: 'O registro de cada decisão tomada por administradores: quem fez, o quê e quando.',
    todo: 'Use para conferir decisões antigas ou entender o que aconteceu num caso.',
    help: 'Este registro não pode ser editado. Toda decisão sobre reclamações e alertas entra aqui automaticamente.',
  },
};

export const GLOSSARY = [
  ['Reclamação', 'Quando o cliente diz que o serviço não foi feito como combinado e pede ajuda antes de o dinheiro ser liberado ao profissional. Também chamada de disputa.'],
  ['Reembolso (estorno)', 'Devolver o dinheiro ao cliente, pelo mesmo meio que ele usou para pagar. A taxa do meio de pagamento pode não ser devolvida pelo Asaas.'],
  ['Reembolso parcial', 'Devolver só uma parte ao cliente. O restante é liberado ao profissional. Útil quando o serviço foi feito, mas com problemas.'],
  ['Manter o pagamento', 'Decidir a favor do profissional: o valor é liberado a ele, como se o cliente tivesse confirmado o serviço.'],
  ['Comissão', 'A parte do pagamento que fica com o Dommos. É a comissão cobrada do profissional mais a taxa de serviço do cliente, se houver.'],
  ['Repasse', 'O dinheiro do pagamento chegando à conta do profissional, depois que o serviço é confirmado. No cartão, pode levar 32 dias.'],
  ['Falha de repasse', 'O serviço foi confirmado, mas o dinheiro não chegou ao profissional. É grave e precisa de ação.'],
  ['Chargeback (contestação)', 'Quando o cliente contesta a cobrança do cartão direto no banco dele. O banco pode tirar o dinheiro de volta, e o Dommos precisa provar que o serviço foi feito.'],
  ['Divisão do pagamento (split)', 'A forma como o valor é repartido automaticamente entre o profissional e o Dommos no momento do pagamento.'],
  ['Conta de recebimento', 'A conta que o profissional cadastra em "Como recebo" para receber os pagamentos. Precisa estar aprovada pelo Asaas para o cliente conseguir pagar.'],
  ['Gateway (Asaas)', 'A empresa que processa os pagamentos (Pix, cartão e boleto) e guarda o dinheiro até o repasse.'],
  ['Webhook', 'Um aviso automático que o Asaas manda ao Dommos a cada mudança num pagamento. Se o aviso falha, o pagamento pode ficar desatualizado até o Asaas reenviar.'],
  ['Pagamento pendente', 'A cobrança foi gerada, mas o cliente ainda não pagou. Se passar de 3 dias, vira alerta.'],
  ['Alerta resolvido', 'Um alerta que um administrador marcou como tratado, com uma nota do que foi feito. Continua no histórico.'],
];

export const SEVERITY = {
  high: { label: 'Gravidade alta', tone: 'bg-danger-soft text-danger-strong' },
  medium: { label: 'Gravidade média', tone: 'bg-warning-soft text-warning-strong' },
  low: { label: 'Gravidade baixa', tone: 'bg-info-soft text-info-strong' },
};
