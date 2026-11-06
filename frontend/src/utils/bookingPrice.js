// Valores e avisos do cartão de contratação. Mesma conta do servidor (orderRules.computeAmounts).
export const UNIT = { hourly: ['hora', 'horas'], daily: ['dia', 'dias'] };

export function priceBreakdown(listing, { packageName, mode, quantity }) {
  const chosen = packageName ? listing.packages.find((item) => item.name === packageName) : null;
  const unitPrice = chosen ? Number(chosen.price) : listing.price == null ? null : Number(listing.price);
  const units = UNIT[listing.pricingModel] ? (quantity ?? 1) : null;
  const service = unitPrice == null ? null : Math.round(unitPrice * (units ?? 1) * 100) / 100;
  const travel = mode === 'client_place' && listing.travelFee ? Number(listing.travelFee) : 0;
  const known = service != null && listing.pricingModel !== 'quote';
  return { unitPrice, units, service: known ? service : null, travel, total: known ? Math.round((service + travel) * 100) / 100 : null, feePercent: listing.platformFeePercent ?? 0 };
}


export const selectionHint = (listing, selection) => {
  if (!selection.date) return 'Escolha a data no calendário';
  if (listing.pricingModel === 'hourly' && !selection.time) return 'Escolha o horário';
  return null;
};
