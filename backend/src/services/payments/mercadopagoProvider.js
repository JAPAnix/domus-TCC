import crypto from 'node:crypto';
import { PaymentProvider } from './PaymentProvider.js';

const apiBase = () => process.env.MP_API_URL || 'https://api.mercadopago.com';
const STATUS_MAP = {
  approved: 'confirmed', authorized: 'pending', pending: 'pending', in_process: 'pending', in_mediation: 'pending',
  rejected: 'cancelled', cancelled: 'cancelled', expired: 'cancelled', refunded: 'refunded', charged_back: 'refunded',
};

export const mercadoPagoConfigured = () => !!(process.env.MP_ACCESS_TOKEN && process.env.MP_WEBHOOK_SECRET && process.env.PUBLIC_API_URL);

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

async function request(method, path, { body, idempotencyKey } = {}) {
  const response = await fetch(apiBase() + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json',
      ...(idempotencyKey && { 'X-Idempotency-Key': idempotencyKey }),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) fail(502, 'O provedor de pagamento recusou a operação. Tente novamente ou use o pagamento direto.');
  return data;
}

/**
 * Valida o cabeçalho x-signature de um webhook do Mercado Pago.
 * Modelo assinado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com HMAC-SHA256 e o segredo do webhook.
 * Retorna o id do pagamento ou lança 401.
 */
export function verifyWebhookSignature({ signature, requestId, dataId, secret, now = Date.now(), toleranceMs = 10 * 60 * 1000 }) {
  if (!secret) fail(503, 'Webhook não configurado.');
  if (!signature || !dataId) fail(401, 'Assinatura ausente.');
  const parts = Object.fromEntries(String(signature).split(',').map((item) => item.trim().split('=')).filter((pair) => pair.length === 2));
  if (!parts.ts || !parts.v1) fail(401, 'Assinatura inválida.');
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const expected = crypto.createHmac('sha256', secret).update(`id:${id};request-id:${requestId ?? ''};ts:${parts.ts};`).digest('hex');
  const given = Buffer.from(parts.v1, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) fail(401, 'Assinatura inválida.');
  const sentAt = Number(parts.ts);
  if (Number.isFinite(sentAt) && Math.abs(now - (sentAt < 1e12 ? sentAt * 1000 : sentAt)) > toleranceMs) fail(401, 'Notificação expirada.');
  return String(dataId);
}

/**
 * Pix automático pelo Mercado Pago. Desligado por padrão: ative com PAYMENT_PROVIDER=mercadopago e as variáveis
 * MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET e PUBLIC_API_URL (ver README). Funciona com credenciais de teste.
 * O valor cai na conta Mercado Pago da plataforma, que repassa ao profissional fora do sistema.
 */
export class MercadoPagoProvider extends PaymentProvider {
  get name() { return 'mercadopago'; }
  get manual() { return false; }

  async createCharge({ payment, order, payer }) {
    const data = await request('POST', '/v1/payments', {
      idempotencyKey: payment.uuidText,
      body: {
        transaction_amount: Number(payment.amount), description: String(order.titleSnapshot).slice(0, 200), payment_method_id: 'pix',
        payer: { email: payer.email }, external_reference: payment.uuidText,
        notification_url: `${process.env.PUBLIC_API_URL.replace(/\/$/, '')}/api/payments/webhook/mercadopago`,
      },
    });
    return { externalId: String(data.id), pixPayload: data.point_of_interaction?.transaction_data?.qr_code ?? null };
  }

  async fetchPayment(externalId) { return request('GET', `/v1/payments/${encodeURIComponent(externalId)}`); }

  async getStatus(payment) {
    const data = await this.fetchPayment(payment.externalId);
    return STATUS_MAP[data.status] ?? 'pending';
  }

  async confirm() { fail(409, 'Este pagamento é confirmado automaticamente pelo provedor.'); }

  async cancel(payment) {
    if (payment.externalId) await request('PUT', `/v1/payments/${encodeURIComponent(payment.externalId)}`, { body: { status: 'cancelled' } });
    return { status: 'cancelled' };
  }

  async refund(payment) {
    await request('POST', `/v1/payments/${encodeURIComponent(payment.externalId)}/refunds`, { idempotencyKey: `refund-${payment.uuidText}`, body: {} });
    return { status: 'refunded' };
  }
}

export { STATUS_MAP as MERCADOPAGO_STATUS_MAP };
