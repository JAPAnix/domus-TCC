// Regras das mensagens, sem acesso a banco: fáceis de testar.

export const MESSAGE_LIMITS = { body: 2000, preview: 140, replyTitle: 60, replyBody: 1000, repliesPerUser: 30, emailEveryMs: 30 * 60 * 1000 };
export const REPORT_REASONS = { spam: 'Spam ou propaganda', abuse: 'Ofensas ou assédio', scam: 'Tentativa de golpe', inappropriate: 'Conteúdo impróprio', other: 'Outro motivo' };
export const SCHEDULES = { none: 'Não programar', before_service: 'Antes do serviço', after_service: 'Depois do serviço', review_request: 'Pedindo avaliação' };

/**
 * Texto da mensagem como é guardado: sem caracteres de controle nem marcas invisíveis de direção do texto,
 * com no máximo uma linha em branco seguida. Nunca vira HTML: as telas sempre mostram como texto puro.
 */
// Faixas removidas: controles C0, DEL, marcas invisíveis e de direção do texto, separadores de linha/parágrafo e BOM.
const UNSAFE_RANGES = [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x2069], [0xfeff, 0xfeff]];
const UNSAFE_CHARS = new RegExp(`[${UNSAFE_RANGES.map(([from, to]) => String.fromCharCode(from) + (from === to ? '' : '-' + String.fromCharCode(to))).join('')}]`, 'g');

export function cleanMessageText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(UNSAFE_CHARS, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const previewOf = (text, hasImage = false) => {
  const flat = cleanMessageText(text).replace(/\s+/g, ' ');
  if (!flat) return hasImage ? 'Foto' : '';
  return flat.length > MESSAGE_LIMITS.preview ? `${flat.slice(0, MESSAGE_LIMITS.preview - 1)}…` : flat;
};

/** Troca {nome_do_cliente}, {nome_do_profissional}, {servico} e {data}. Variáveis desconhecidas ficam como estão. */
export function fillTemplate(body, vars) {
  return String(body).replace(/\{(nome_do_cliente|nome_do_profissional|servico|data)\}/g, (match, name) => vars[name] ?? match);
}

const RULES = [
  { test: /\b(pre[cç]o|valor|quanto|or[cç]amento|cobra)/i, text: 'O valor depende dos detalhes do serviço. Me conte um pouco mais e eu confirmo o preço certinho.' },
  { test: /\b(quando|hor[aá]rio|data|dispon[ií]vel|agenda)\b|que dia/i, text: 'Posso atender nos dias indicados no anúncio. Qual data fica melhor para você?' },
  { test: /\b(endere[cç]o|onde|local|regi[aã]o|bairro)/i, text: 'Atendo na região informada no anúncio. Me passe o seu bairro para eu confirmar.' },
  { test: /\b(obrigad[oa]|valeu|agrade[cç]o)/i, text: 'Por nada! Qualquer dúvida, é só chamar.' },
  { test: /\b(oi|ol[aá]|bom dia|boa tarde|boa noite)\b/i, text: 'Olá! Como posso ajudar?' },
  { test: /\b(pix|pagar|pagamento)/i, text: 'O pagamento é combinado direto, pelo pedido: você vê a chave Pix e o QR Code por lá.' },
];

const words = (text) => new Set(String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{4,}/g) ?? []);

/**
 * Sugestões baseadas só em regras e nos modelos do próprio usuário (sem IA, sem API paga).
 * Primeiro os modelos cujo título ou texto compartilham palavras com a última mensagem recebida, depois as regras.
 */
export function suggestReplies(lastIncoming, quickReplies = [], limit = 3) {
  if (!lastIncoming || !cleanMessageText(lastIncoming)) return [];
  const incoming = words(lastIncoming);
  const fromReplies = quickReplies
    .filter((reply) => { const shared = [...words(`${reply.title} ${reply.text ?? reply.body}`)].filter((word) => incoming.has(word)); return shared.length > 0; })
    .map((reply) => ({ text: reply.text ?? reply.body, source: 'quick_reply', title: reply.title }));
  const fromRules = RULES.filter((rule) => rule.test.test(lastIncoming)).map((rule) => ({ text: rule.text, source: 'rule' }));
  const seen = new Set();
  return [...fromReplies, ...fromRules].filter((item) => !seen.has(item.text) && seen.add(item.text)).slice(0, limit);
}

const HOUR = 60 * 60 * 1000;
const SERVICE_START_HOUR_UTC = 11; // 8h em Brasília

/** Quando uma resposta programada deve sair. `order.scheduledDate` é uma data (UTC, meia-noite). */
export function scheduledDueAt(schedule, order, offsetHours) {
  if (schedule === 'before_service') return new Date(new Date(order.scheduledDate).getTime() + SERVICE_START_HOUR_UTC * HOUR - offsetHours * HOUR);
  if ((schedule === 'after_service' || schedule === 'review_request') && order.completedAt) return new Date(new Date(order.completedAt).getTime() + offsetHours * HOUR);
  return null;
}

/** Envia só dentro de uma janela útil, para criar um modelo novo não disparar mensagens sobre pedidos antigos. */
export function withinSendWindow(schedule, order, now = new Date()) {
  if (schedule === 'before_service') return new Date(order.scheduledDate).getTime() + 24 * HOUR > now.getTime();
  return !!order.completedAt && now.getTime() - new Date(order.completedAt).getTime() < 7 * 24 * HOUR;
}
