// Alertas do administrador: o que significam, por que importam e o que fazer. Texto em linguagem simples.
export const ALERT_INFO = {
  chargeback: {
    title: 'Contestação de cartão (chargeback)', severity: 'high',
    meaning: 'O cliente contestou a cobrança do cartão direto no banco dele.',
    why: 'O banco pode tirar o dinheiro de volta e o pagamento fica travado até a análise terminar.',
    action: 'Abra o pagamento, junte as provas do serviço feito e responda ao Asaas no prazo.', actionLabel: 'Ver o pagamento',
  },
  refund_failed: {
    title: 'Reembolso não concluído', severity: 'high',
    meaning: 'Um reembolso foi pedido, mas o gateway não conseguiu devolver o dinheiro ao cliente.',
    why: 'O cliente continua sem o dinheiro de volta e a reclamação pode ficar sem fim.',
    action: 'Veja o motivo no pagamento e tente de novo. Se persistir, resolva direto no painel do Asaas e marque como resolvido.', actionLabel: 'Ver o pagamento',
  },
  release_failed: {
    title: 'Falha no repasse ao profissional', severity: 'high',
    meaning: 'O serviço foi confirmado, mas o dinheiro não chegou ao profissional.',
    why: 'O profissional fez o trabalho e não recebeu. Isso gera reclamação e perda de confiança.',
    action: 'Abra o pagamento e confira o motivo. Confirme com o Asaas se a conta de recebimento está ativa e tente liberar de novo.', actionLabel: 'Ver o pagamento',
  },
  split_problem: {
    title: 'Problema na divisão do pagamento', severity: 'medium',
    meaning: 'O gateway avisou que a divisão entre o profissional e o Dommos foi cancelada ou ficou divergente.',
    why: 'O valor pode ter sido dividido errado, com prejuízo para o profissional ou para a plataforma.',
    action: 'Abra o pagamento e compare os valores com o painel do Asaas. Corrija lá e marque como resolvido.', actionLabel: 'Ver o pagamento',
  },
  paid_after_close: {
    title: 'Pagamento recebido depois de o pedido encerrar', severity: 'medium',
    meaning: 'Chegou um pagamento de um pedido que já estava cancelado ou estornado.',
    why: 'O cliente pagou por um serviço que não vai acontecer e precisa receber o dinheiro de volta.',
    action: 'Estorne o valor ao cliente pelo painel do Asaas e marque como resolvido.', actionLabel: 'Ver o pagamento',
  },
  stale_pending: {
    title: 'Pagamento pendente há muito tempo', severity: 'low',
    meaning: 'O cliente gerou a cobrança, mas não pagou há mais de 3 dias.',
    why: 'O profissional pode estar esperando para começar e o pedido fica parado.',
    action: 'Avise o cliente pelo pedido. Some sozinho quando o pagamento for feito ou cancelado.', actionLabel: 'Ver o pedido',
  },
  webhook_failed: {
    title: 'Aviso do gateway não processado', severity: 'medium',
    meaning: 'O Asaas avisou de uma mudança (por exemplo, um pagamento) e o sistema não conseguiu processar.',
    why: 'O pagamento pode estar pago no Asaas e aparecer como pendente aqui. O Asaas reenvia, mas após muitas falhas pausa os avisos.',
    action: 'Veja o erro na aba Webhooks. Se o erro persistir, peça ajuda a quem mantém o sistema. Some sozinho quando o reenvio funcionar.', actionLabel: 'Ver webhooks',
  },
  pro_without_account: {
    title: 'Profissional sem conta de recebimento ativa', severity: 'low',
    meaning: 'Um profissional com serviço publicado ainda não tem a conta de recebimento aprovada.',
    why: 'Os clientes não conseguem pagar pelos pedidos dele, e a venda se perde.',
    action: 'Oriente o profissional a concluir o cadastro em Configurações > Pagamentos > Como recebo. Some sozinho quando a conta for aprovada.', actionLabel: null,
  },
};

export const SEVERITY_LABELS = { high: 'Alta', medium: 'Média', low: 'Baixa' };
export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/** Explica por que um evento do gateway foi ignorado (não é erro: o Dommos só usa alguns eventos). */
export const IGNORED_REASONS = {
  evento_desconhecido: 'Evento do Asaas que o Dommos não usa (por exemplo, o cliente abriu a página de pagamento). Sem efeito.',
  sem_mudanca: 'O pagamento já estava neste estado. Sem efeito.',
  estado_final: 'O pedido já estava encerrado. Pode ter gerado um alerta.',
  transicao_invalida: 'A mudança não faz sentido para o estado atual do pagamento. Sem efeito.',
};
export const ignoredText = (reason) => IGNORED_REASONS[reason] ?? 'O Dommos não precisou fazer nada com este evento.';
