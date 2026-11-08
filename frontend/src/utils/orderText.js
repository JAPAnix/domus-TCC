/** "há 5 min", "há 3 h", "há 2 dias": há quanto tempo algo aconteceu. */
export function timeSince(value, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/** Texto do prazo que falta e o tom do aviso, a partir de `order.urgency` e do papel de quem vê. */
export function deadlineNotice(order) {
  const { urgency, status, role } = order;
  if (!urgency || !['requested', 'proposed'].includes(status)) return null;
  const left = urgency.hoursLeft <= 1 ? 'menos de 1 hora' : urgency.hoursLeft < 48 ? `${urgency.hoursLeft} horas` : `${Math.ceil(urgency.hoursLeft / 24)} dias`;
  const proposed = status === 'proposed';
  const text = urgency.level === 'expired' ? (proposed ? 'Proposta vencida' : 'Prazo de resposta encerrado')
    : proposed ? `A proposta vale por mais ${left}` : role === 'professional' ? `Responda em ${left}` : `O profissional tem mais ${left} para responder`;
  const tone = urgency.level === 'urgent' || urgency.level === 'expired' ? 'bg-danger-soft text-danger' : urgency.level === 'soon' ? 'bg-warning-soft text-warning' : 'bg-surface-muted text-ink-soft';
  return { text, tone, level: urgency.level };
}

/** "Prazo de 5 dias" ou "Execução em 12/12/2026", conforme a proposta. */
export function proposalTerm(proposal, formatDay) {
  if (proposal.date) return `Execução em ${formatDay(proposal.date)}`;
  if (proposal.days) return `Prazo de ${proposal.days} ${proposal.days === 1 ? 'dia' : 'dias'}`;
  return 'Prazo a combinar';
}
