import { formatMoney } from './format';

export const MODE_LABELS = { client_place: 'Na casa do cliente', pro_place: 'No local do profissional', remote: 'Online / remoto', negotiated: 'Combinado na proposta' };
export const MODE_HELP = {
  client_place: 'Você vai até o cliente. Dá para cobrar taxa de deslocamento.',
  pro_place: 'O cliente vai até você, no seu ateliê, loja ou escritório.',
  remote: 'Atendimento por vídeo, telefone ou entrega digital.',
};
export const PRICING_LABELS = { hourly: 'Por hora', daily: 'Por diária', fixed: 'Valor fechado (por projeto)', quote: 'Sob consulta' };
export const PRICING_HELP = {
  hourly: 'O cliente paga pelo tempo trabalhado. O total é informado por você ao concluir.',
  daily: 'Valor por dia de trabalho. O total é informado por você ao concluir.',
  fixed: 'Um valor único pelo serviço combinado.',
  quote: 'Sem preço público: o cliente combina o valor com você depois do pedido.',
};
export const POLICY_INFO = {
  flexible: { label: 'Flexível', text: 'Cancelamento sem custo até 24 horas antes da data combinada.' },
  moderate: { label: 'Moderada', text: 'Cancelamento sem custo até 72 horas antes da data combinada.' },
  strict: { label: 'Rígida', text: 'Cancelamento sem custo até 7 dias antes da data combinada.' },
};
export const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const unit = { hourly: '/hora', daily: '/dia', fixed: '', quote: '' };

/** "R$ 150,00", "R$ 40,00/hora" ou "Sob consulta". */
export function priceLabel(listing) {
  if (listing.pricingModel === 'quote' || listing.price == null) return 'Sob consulta';
  return `${formatMoney(listing.price)}${unit[listing.pricingModel] ?? ''}`;
}

export function locationLabel(listing) {
  const place = [listing.city, listing.state].filter(Boolean).join(', ');
  if (listing.serviceModes?.length === 1 && listing.serviceModes[0] === 'remote') return 'Online';
  return place || (listing.serviceModes?.includes('remote') ? 'Online' : '');
}

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const weekdayOf = (key) => new Date(`${key}T12:00:00Z`).getUTCDay();

/** Valor estimado de um pedido de valor fechado (pacote ou preço do anúncio, mais deslocamento). Nulo nos outros modelos. */
export function estimateTotal(listing, packageName, mode) {
  if (listing.pricingModel !== 'fixed') return null;
  const chosen = packageName ? listing.packages.find((item) => item.name === packageName) : null;
  const base = chosen ? Number(chosen.price) : listing.price;
  if (base == null) return null;
  return Math.round((base + (mode === 'client_place' && listing.travelFee ? Number(listing.travelFee) : 0)) * 100) / 100;
}
