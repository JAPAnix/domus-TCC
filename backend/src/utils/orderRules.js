// Regras das contratações, sem acesso a banco: fáceis de testar.
import { unitsTotal } from './bookingSlots.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

// Quem faz a ação e de qual status ela parte.
export const ORDER_ACTIONS = {
  accept: { from: ['requested'], to: 'accepted', who: ['professional'] },
  decline: { from: ['requested'], to: 'declined', who: ['professional'] },
  start: { from: ['accepted'], to: 'in_progress', who: ['professional'] },
  complete: { from: ['in_progress'], to: 'completed', who: ['professional'] },
  // O cliente cancela até concluir. O profissional recusa o pedido novo e cancela depois de aceitar.
  cancel: { from: ['requested', 'accepted', 'in_progress'], to: 'cancelled', who: ['client', 'professional'], professionalFrom: ['accepted', 'in_progress'] },
};

export const ORDER_STATUS_LABELS = {
  requested: 'Aguardando resposta', accepted: 'Aceito', in_progress: 'Em andamento', completed: 'Concluído', declined: 'Recusado', cancelled: 'Cancelado',
};

export function roleIn(order, userId) {
  if (order.clientId === userId) return 'client';
  if (order.professionalId === userId) return 'professional';
  return null;
}

/** Retorna { to } ou lança erro com status HTTP. */
export function resolveTransition(order, userId, action) {
  const rule = ORDER_ACTIONS[action];
  if (!rule) fail(404, 'Ação não encontrada.');
  const role = roleIn(order, userId);
  if (!role) fail(403, 'Acesso negado.');
  if (!rule.who.includes(role)) fail(403, 'Esta ação não está disponível para você.');
  if (!rule.from.includes(order.status)) fail(409, 'O pedido já foi atualizado. Recarregue a página.');
  if (role === 'professional' && rule.professionalFrom && !rule.professionalFrom.includes(order.status)) fail(409, 'Para um pedido novo, use "Recusar".');
  return { to: rule.to, role };
}

/** Ações que o usuário pode fazer agora (alimenta os botões da tela). */
export function availableActions(order, userId) {
  return Object.keys(ORDER_ACTIONS).filter((action) => {
    try { resolveTransition(order, userId, action); return true; } catch { return false; }
  });
}

const round = (value) => Math.round(value * 100) / 100;

/**
 * Valores copiados do anúncio no momento do pedido. Em "por hora" e "por diária" o valor é por unidade e o total
 * só é conhecido no fim, por isso `total` é nulo; o profissional informa o valor final ao concluir.
 */
export function computeAmounts(listing, { packageName, serviceMode, quantity = null }) {
  const packages = Array.isArray(listing.packages) ? listing.packages : [];
  const chosen = packageName ? packages.find((item) => item.name === packageName) : null;
  if (packageName && !chosen) fail(400, 'Pacote inválido.');
  const base = chosen ? Number(chosen.price) : listing.price == null ? null : Number(listing.price);
  const travelFee = serviceMode === 'client_place' && listing.travelFee != null ? Number(listing.travelFee) : null;
  const total = listing.pricingModel === 'fixed' && base != null ? round(base + (travelFee ?? 0)) : unitsTotal(listing.pricingModel, base, quantity, travelFee);
  return { price: base, travelFee, total };
}

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Primeira data que o cliente pode escolher, considerando a antecedência mínima do anúncio. */
export function earliestDate(now, leadTimeHours = 0) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setDate(date.getDate() + Math.ceil(Number(leadTimeHours) / 24));
  return dateKey(date);
}

export function weekdayOf(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** Mensagem de erro se a data não puder ser contratada, ou null. */
export function bookingDateError(availability, dateStr, now, blockedDates = new Set()) {
  // O JavaScript aceita "30/02" e converte para março; por isso a data precisa voltar igual depois de lida.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T12:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateStr) return 'Escolha uma data válida.';
  if (dateStr < earliestDate(now, availability?.leadTimeHours ?? 0)) return 'Esta data não respeita a antecedência mínima do profissional.';
  const days = Array.isArray(availability?.weekdays) ? availability.weekdays : [];
  if (!days.some((day) => day.day === weekdayOf(dateStr))) return 'O profissional não atende neste dia da semana.';
  if (blockedDates.has(dateStr)) return 'O profissional não está disponível nesta data.';
  return null;
}
