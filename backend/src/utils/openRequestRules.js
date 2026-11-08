// Regras puras do pedido aberto (sem banco), para testar sem depender de nada.

export const REPORT_REASONS = {
  contact: 'Tenta levar a conversa para fora da plataforma',
  scam: 'Parece golpe ou cobrança indevida',
  prohibited: 'Serviço ou conteúdo proibido',
  offensive: 'Conteúdo ofensivo',
  spam: 'Spam ou propaganda',
  other: 'Outro motivo',
};

const HOUR = 3600000;

/** Transições permitidas do pedido aberto. Quem decide o que é feito por quem fica nas rotas; aqui só o "pode ou não pode". */
export const REQUEST_TRANSITIONS = {
  draft: ['open', 'cancelled'],
  open: ['in_progress', 'cancelled', 'expired', 'removed'],
  expired: ['open', 'cancelled', 'removed'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  removed: [],
};

export const canTransition = (from, to) => !!REQUEST_TRANSITIONS[from]?.includes(to);

/** O que impede este profissional de enviar proposta (lista vazia = pode). Mensagens claras, na ordem em que ele resolve. */
export function proposalBlockers({ hasProfile, profileComplete = true, asaasActive, payoutStatus }) {
  const blockers = [];
  if (!hasProfile) blockers.push('Crie o seu perfil profissional para enviar propostas.');
  else if (!profileComplete) blockers.push('Complete o seu perfil profissional (nome e apresentação) para enviar propostas.');
  if (hasProfile && asaasActive && payoutStatus !== 'approved') blockers.push('Cadastre e aprove a sua conta de recebimento em Configurações > Pagamentos para receber por pedidos abertos.');
  return blockers;
}

/** O pedido exige profissional verificado ou nota mínima: este profissional atende? */
export function meetsPreferences(service, profile) {
  if (service.onlyVerified && !profile?.isVerified) return false;
  if (service.minRating != null && Number(profile?.averageRating ?? 0) < Number(service.minRating)) return false;
  return true;
}

/** Quantas propostas contam para o limite: as que ainda estão valendo. */
export const countsTowardLimit = (status) => status === 'pending' || status === 'accepted';

/**
 * Decide o que a rotina de expiração faz. Recebe pedidos abertos { id, status, expiresAt } e propostas pendentes
 * { id, validUntil }. Devolve o que expira agora e o que ganha aviso (vence em até `warnHours`).
 */
export function planRequestExpiry({ services = [], proposals = [] }, now = new Date(), warnHours = 24) {
  const toExpire = [], toWarn = [], proposalsToExpire = [];
  for (const service of services) {
    if (service.status !== 'open' || !service.expiresAt) continue;
    const left = new Date(service.expiresAt).getTime() - now.getTime();
    if (left <= 0) toExpire.push(service.id);
    else if (left <= warnHours * HOUR) toWarn.push({ id: service.id, hoursLeft: Math.ceil(left / HOUR) });
  }
  for (const proposal of proposals) {
    if (proposal.validUntil && new Date(proposal.validUntil).getTime() <= now.getTime()) proposalsToExpire.push(proposal.id);
  }
  return { toExpire, toWarn, proposalsToExpire };
}

/** Texto de quanto falta, para avisos e telas: "menos de 1 hora", "5 horas", "3 dias". */
export function timeLeftText(hours) {
  if (hours <= 1) return 'menos de 1 hora';
  if (hours < 48) return `${hours} horas`;
  return `${Math.ceil(hours / 24)} dias`;
}
