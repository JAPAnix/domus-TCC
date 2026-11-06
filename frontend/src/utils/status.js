export const serviceStatus = {
  draft: { label: 'Rascunho', tone: 'bg-surface-muted text-ink-soft' },
  open: { label: 'Recebendo propostas', tone: 'bg-info-soft text-info' },
  in_progress: { label: 'Em andamento', tone: 'bg-warning-soft text-warning' },
  completed: { label: 'Concluído', tone: 'bg-success-soft text-success' },
  cancelled: { label: 'Cancelado', tone: 'bg-surface-muted text-ink-soft' },
};

export const proposalStatus = {
  pending: { label: 'Pendente', tone: 'bg-warning-soft text-warning' },
  accepted: { label: 'Aceita', tone: 'bg-success-soft text-success' },
  rejected: { label: 'Rejeitada', tone: 'bg-danger-soft text-danger' },
  withdrawn: { label: 'Retirada', tone: 'bg-surface-muted text-ink-soft' },
};

export const orderStatus = {
  requested: { label: 'Aguardando resposta', tone: 'bg-warning-soft text-warning' },
  accepted: { label: 'Aceito', tone: 'bg-info-soft text-info' },
  in_progress: { label: 'Em andamento', tone: 'bg-primary-soft text-primary-strong' },
  completed: { label: 'Concluído', tone: 'bg-success-soft text-success' },
  declined: { label: 'Recusado', tone: 'bg-danger-soft text-danger' },
  cancelled: { label: 'Cancelado', tone: 'bg-surface-muted text-ink-soft' },
};

export const listingStatus = {
  draft: { label: 'Rascunho', tone: 'bg-surface-muted text-ink-soft' },
  published: { label: 'Publicado', tone: 'bg-success-soft text-success' },
  paused: { label: 'Pausado', tone: 'bg-warning-soft text-warning' },
};

export const paymentStatus = {
  pending: { label: 'Aguardando pagamento', tone: 'bg-warning-soft text-warning' },
  reported: { label: 'Aguardando confirmação', tone: 'bg-info-soft text-info' },
  confirmed: { label: 'Pagamento confirmado', tone: 'bg-success-soft text-success' },
  cancelled: { label: 'Cancelado', tone: 'bg-surface-muted text-ink-soft' },
  refunded: { label: 'Estornado', tone: 'bg-danger-soft text-danger' },
  expired: { label: 'Expirado', tone: 'bg-surface-muted text-ink-soft' },
  refused: { label: 'Recusado', tone: 'bg-danger-soft text-danger' },
  disputed: { label: 'Em reclamação', tone: 'bg-info-soft text-info' },
  chargeback: { label: 'Contestado', tone: 'bg-danger-soft text-danger' },
};
