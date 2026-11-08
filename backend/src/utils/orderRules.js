// Regras das contratações, sem acesso a banco: fáceis de testar.
import { unitsTotal } from './bookingSlots.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

// Quem faz a ação e de qual status ela parte.
export const ORDER_ACTIONS = {
  accept: { from: ['requested'], to: 'accepted', who: ['professional'] },
  // Pedidos "sob consulta" (sem preço) passam por proposta: o profissional informa valor e prazo, o cliente decide.
  propose: { from: ['requested'], to: 'proposed', who: ['professional'] },
  accept_proposal: { from: ['proposed'], to: 'accepted', who: ['client'] },
  reject_proposal: { from: ['proposed'], to: 'cancelled', who: ['client'] },
  decline: { from: ['requested'], to: 'declined', who: ['professional'] },
  start: { from: ['accepted'], to: 'in_progress', who: ['professional'] },
  complete: { from: ['in_progress'], to: 'completed', who: ['professional'] },
  // O cliente cancela até concluir. O profissional recusa o pedido novo e cancela depois de aceitar.
  cancel: { from: ['requested', 'proposed', 'accepted', 'in_progress'], to: 'cancelled', who: ['client', 'professional'], professionalFrom: ['accepted', 'in_progress'] },
};

export const ORDER_STATUS_LABELS = {
  requested: 'Aguardando resposta', proposed: 'Proposta enviada', accepted: 'Aceito', in_progress: 'Em andamento', completed: 'Concluído', declined: 'Recusado', cancelled: 'Cancelado', expired: 'Expirado',
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
  const quote = order.pricingModelSnapshot === 'quote';
  if (action === 'accept' && quote) fail(409, 'Este pedido é sob consulta: envie uma proposta com o valor e o prazo.');
  if (action === 'propose' && !quote) fail(409, 'Só pedidos sob consulta recebem proposta. Este tem preço definido: aceite ou recuse.');
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

/** O cliente vê o endereço inteiro; o profissional só vê bairro e cidade até aceitar o pedido. */
export function addressFor(order, viewerId) {
  const address = order.serviceAddress;
  if (!address || typeof address !== 'object') return null;
  const isClient = viewerId != null && order.clientId === viewerId;
  if (isClient || ['accepted', 'in_progress', 'completed'].includes(order.status)) return address;
  return { neighborhood: address.neighborhood, city: address.city, state: address.state, partial: true };
}

// ---- Prazos de resposta, propostas e expiração ------------------------------------------------------------------------------

/** Quanto tempo o profissional tem para responder a um pedido novo. */
export const RESPONSE_HOURS = 72;
/** Opções de validade de uma proposta, em horas. */
export const VALIDITY_OPTIONS = [24, 48, 72, 168];
export const DEFAULT_VALIDITY_HOURS = 48;
/** Aviso de que algo está perto de vencer. */
export const WARN_BEFORE_HOURS = 24;

const HOUR = 3600000;

/** Quando o pedido vence se ninguém agir: o prazo de resposta (novo) ou a validade da proposta (proposta enviada). */
export function deadlineOf(order) {
  if (order.status === 'requested') return order.expiresAt ?? null;
  if (order.status === 'proposed') return order.proposalValidUntil ?? null;
  return null;
}

/** Quanto falta para vencer e quão urgente é: urgent (menos de 6 h), soon (menos de 24 h) ou ok. Sem prazo, devolve null. */
export function urgency(order, now = new Date()) {
  const deadline = deadlineOf(order);
  if (!deadline) return null;
  const left = new Date(deadline).getTime() - now.getTime();
  const hoursLeft = Math.max(0, Math.ceil(left / HOUR));
  return { deadline: new Date(deadline), hoursLeft, level: left <= 0 ? 'expired' : left < 6 * HOUR ? 'urgent' : left < WARN_BEFORE_HOURS * HOUR ? 'soon' : 'ok' };
}

const dayKey = (date) => date.toISOString().slice(0, 10);

/** Confere os dados da proposta e devolve tudo normalizado. Lança erro 400 com mensagem em português. */
export function parseProposal(body = {}, now = new Date()) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) fail(400, 'Informe o valor da proposta, maior que zero.');
  if (amount > 1000000) fail(400, 'Valor alto demais.');
  const days = body.days == null || body.days === '' ? null : Number(body.days);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) fail(400, 'O prazo deve ser de 1 a 365 dias.');
  const date = body.date ? String(body.date) : null;
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < dayKey(now))) fail(400, 'A data de execução não pode estar no passado.');
  if (days === null && !date) fail(400, 'Informe em quantos dias você faz o serviço ou a data de execução.');
  const included = String(body.included ?? '').trim();
  const note = String(body.note ?? '').trim();
  if (included.length > 500) fail(400, 'O que está incluso pode ter até 500 caracteres.');
  if (note.length > 1000) fail(400, 'As observações podem ter até 1000 caracteres.');
  const validHours = body.valid_hours == null || body.valid_hours === '' ? DEFAULT_VALIDITY_HOURS : Number(body.valid_hours);
  if (!VALIDITY_OPTIONS.includes(validHours)) fail(400, 'Escolha a validade da proposta: 24 horas, 48 horas, 72 horas ou 7 dias.');
  return { amount: Math.round(amount * 100) / 100, days, date, included: included || null, note: note || null, validHours, validUntil: new Date(now.getTime() + validHours * HOUR) };
}

/**
 * Decide o que a rotina de expiração faz: quais pedidos vencem agora e quais ganham aviso de que estão perto de vencer.
 * Recebe linhas com { id, status, expiresAt, proposalValidUntil }.
 */
export function planExpiry(rows, now = new Date()) {
  const toExpire = [], toWarn = [];
  for (const row of rows) {
    const deadline = deadlineOf(row);
    if (!deadline) continue;
    const left = new Date(deadline).getTime() - now.getTime();
    if (left <= 0) toExpire.push(row.id);
    else if (left <= WARN_BEFORE_HOURS * HOUR) toWarn.push({ id: row.id, status: row.status, hoursLeft: Math.ceil(left / HOUR) });
  }
  return { toExpire, toWarn };
}
