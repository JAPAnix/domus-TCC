import { currencies, defaults } from '../i18n/config';

// Único ponto de formatação de preços do sistema. Não use Intl.NumberFormat direto nas telas.
const currencyFormatter = new Intl.NumberFormat(currencies[defaults.currency].locale, { style: 'currency', currency: defaults.currency });

export function formatMoney(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return 'Não informado';
  return currencyFormatter.format(Number(value));
}

/** Faixa de orçamento, cobrindo pedidos sem mínimo ou sem máximo. */
export function formatBudget(min, max) {
  if (min != null && max != null) return `${formatMoney(min)} a ${formatMoney(max)}`;
  if (max != null) return `Até ${formatMoney(max)}`;
  if (min != null) return `A partir de ${formatMoney(min)}`;
  return 'A combinar';
}

/** Data sem hora ("2026-11-05"), sem deslocamento por fuso horário. */
export function formatDay(value, options) {
  if (!value) return 'Não informado';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleDateString(defaults.language, options);
}

export function fullName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ');
}
