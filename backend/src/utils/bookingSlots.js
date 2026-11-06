// Horários, intervalos de datas e conflitos das contratações. Sem acesso a banco.
// Este arquivo é idêntico em backend/src/utils e frontend/src/utils; um teste confere.

export const MAX_HOURS = 12;
export const MAX_DAYS = 30;

const pad = (n) => String(n).padStart(2, '0');
export const toMinutes = (time) => { const [h, m] = String(time).split(':').map(Number); return h * 60 + m; };
export const fromMinutes = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Soma dias a uma data "AAAA-MM-DD" (sem depender do fuso do computador). */
export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Datas ocupadas por uma contratação por diária: a data inicial e as seguintes. */
export const daysOf = (date, quantity = 1) => Array.from({ length: Math.max(1, quantity) }, (_, index) => addDays(date, index));

/** Horários cheios ocupados por uma contratação por hora: "09:00", "10:00"... */
export function hourSlots(time, quantity = 1) {
  const start = toMinutes(time);
  return Array.from({ length: Math.max(1, quantity) }, (_, index) => fromMinutes(start + index * 60));
}

/** Horários que o profissional atende em um dia da semana: início de cada hora entre "de" e "até". */
export function dayHours(window) {
  if (!window) return [];
  const from = toMinutes(window.from);
  const to = toMinutes(window.to);
  const hours = [];
  for (let minutes = Math.ceil(from / 60) * 60; minutes + 60 <= to; minutes += 60) hours.push(fromMinutes(minutes));
  return hours;
}

/**
 * Confere horário e quantidade conforme o modelo de preço do anúncio. Retorna a mensagem de erro ou null.
 * `window` é { from, to } do dia da semana escolhido.
 */
export function slotError(pricingModel, { time, quantity }, window) {
  if (pricingModel === 'hourly') {
    const hours = Number(quantity ?? 1);
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) return `Escolha de 1 a ${MAX_HOURS} horas.`;
    if (!time || !TIME.test(time) || !time.endsWith(':00')) return 'Escolha o horário de início.';
    const available = dayHours(window);
    const wanted = hourSlots(time, hours);
    if (!wanted.every((slot) => available.includes(slot))) return 'O profissional não atende em todo esse período. Escolha outro horário ou menos horas.';
    return null;
  }
  if (pricingModel === 'daily') {
    const days = Number(quantity ?? 1);
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return `Escolha de 1 a ${MAX_DAYS} dias.`;
  }
  return null;
}

/** Quantidade que vale para o pedido: horas, dias, ou nenhuma nos outros modelos. */
export function normalizeQuantity(pricingModel, quantity) {
  if (pricingModel === 'hourly' || pricingModel === 'daily') return Number(quantity ?? 1);
  return null;
}

/**
 * `orders`: pedidos já aceitos do anúncio, com { pricingModel, date, time, quantity }.
 * Retorna o que está ocupado: { hours: { data: ["09:00"] }, days: ["data"] }.
 */
export function busyOf(orders) {
  const hours = {};
  const days = new Set();
  for (const order of orders) {
    if (order.pricingModel === 'hourly' && order.time) {
      hours[order.date] = [...new Set([...(hours[order.date] ?? []), ...hourSlots(order.time, order.quantity)])].sort();
    } else if (order.pricingModel === 'daily') {
      for (const day of daysOf(order.date, order.quantity)) days.add(day);
    }
  }
  return { hours, days: [...days].sort() };
}

/** O pedido novo bate com algo já aceito? Só vale para por hora e por diária. */
export function hasConflict(candidate, orders) {
  const busy = busyOf(orders);
  if (candidate.pricingModel === 'hourly') {
    const taken = new Set(busy.hours[candidate.date] ?? []);
    return hourSlots(candidate.time, candidate.quantity).some((slot) => taken.has(slot));
  }
  if (candidate.pricingModel === 'daily') {
    const taken = new Set(busy.days);
    return daysOf(candidate.date, candidate.quantity).some((day) => taken.has(day));
  }
  return false;
}

/** Total conhecido na hora do pedido: por hora e por diária (valor x quantidade), mais deslocamento. */
export function unitsTotal(pricingModel, price, quantity, travelFee = 0) {
  if (price == null || !quantity || (pricingModel !== 'hourly' && pricingModel !== 'daily')) return null;
  return Math.round((Number(price) * quantity + Number(travelFee ?? 0)) * 100) / 100;
}
