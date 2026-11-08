/**
 * Tipos de notificação e canais. Só entram canais que existem de verdade:
 * "app" (central de notificações do site) e "email". Não há push nem WhatsApp.
 * Para acrescentar um tipo, inclua aqui e use o mesmo `type` ao chamar notify().
 */
export const NOTIFICATION_CATALOG = {
  account: [
    { key: 'proposal_received', title: 'Nova proposta recebida', description: 'Quando um profissional responde a um pedido seu.', channels: ['app', 'email'] },
    { key: 'new_opportunity', title: 'Novas oportunidades', description: 'Resumo de pedidos abertos novos que combinam com os seus serviços (no máximo um a cada poucas horas).', channels: ['app', 'email'] },
    { key: 'proposal_accepted', title: 'Proposta aceita', description: 'Quando um cliente aceita a sua proposta.', channels: ['app', 'email'] },
    { key: 'service_completed', title: 'Serviço concluído', description: 'Quando um serviço é concluído e a avaliação é liberada.', channels: ['app', 'email'] },
    { key: 'order_received', title: 'Novo pedido de contratação', description: 'Quando alguém solicita um dos seus serviços.', channels: ['app', 'email'] },
    { key: 'order_update', title: 'Atualização de um pedido', description: 'Quando um pedido é aceito, recusado, iniciado ou cancelado.', channels: ['app', 'email'] },
    { key: 'message_new', title: 'Nova mensagem', description: 'E-mail quando você recebe uma mensagem e está fora do Dommos (no máximo um a cada 30 minutos por conversa).', channels: ['email'] },
    { key: 'payment_update', title: 'Pagamentos', description: 'Quando um pagamento é informado, confirmado, cancelado ou estornado.', channels: ['app', 'email'] },
    { key: 'review_received', title: 'Avaliação recebida', description: 'Quando alguém avalia você.', channels: ['app', 'email'] },
  ],
  offers: [
    { key: 'product_news', title: 'Novidades do Dommos', description: 'Novos recursos e melhorias da plataforma.', channels: ['email'] },
    { key: 'pro_tips', title: 'Dicas para profissionais', description: 'Boas práticas para receber mais pedidos.', channels: ['email'] },
  ],
};

const ALL = [...NOTIFICATION_CATALOG.account, ...NOTIFICATION_CATALOG.offers];
const isOffer = (key) => NOTIFICATION_CATALOG.offers.some((item) => item.key === key);

export function defaultPreferences() {
  return Object.fromEntries(ALL.map((item) => [item.key, Object.fromEntries(item.channels.map((channel) => [channel, !isOffer(item.key)]))]));
}

/** Preferências salvas somadas às padrão: tipos novos aparecem ligados (conta) ou desligados (ofertas). */
export function resolvePreferences(stored) {
  const base = defaultPreferences();
  if (!stored || typeof stored !== 'object') return base;
  for (const item of ALL) {
    for (const channel of item.channels) {
      if (typeof stored[item.key]?.[channel] === 'boolean') base[item.key][channel] = stored[item.key][channel];
    }
  }
  return base;
}

/** Aplica uma alteração parcial. Tipos ou canais desconhecidos são recusados. */
export function applyPreferencePatch(stored, patch) {
  const next = resolvePreferences(stored);
  for (const [key, channels] of Object.entries(patch ?? {})) {
    const item = ALL.find((entry) => entry.key === key);
    if (!item) throw Object.assign(new Error(`Tipo de notificação desconhecido: ${key}.`), { status: 400 });
    for (const [channel, value] of Object.entries(channels)) {
      if (!item.channels.includes(channel)) throw Object.assign(new Error(`O canal "${channel}" não existe para "${item.title}".`), { status: 400 });
      next[key][channel] = value;
    }
  }
  return next;
}
