import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { PAYMENT_METHODS, parseAcceptedMethods } from '../utils/paymentRules.js';
import { activeProvider } from '../services/payments/index.js';
import {
  actOnPayment, getReceipt, listPayments, orderPaymentState, processMercadoPagoWebhook, saveReceivingSettings, startPayment,
} from '../services/paymentWorkflow.js';
import { normalizePayoutKey } from '../validators/areaValidator.js';

const me = (req) => BigInt(req.user.id);

function fail(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}

export async function config(req, res) {
  const provider = activeProvider();
  res.json({
    provider: provider.name, automatic: !provider.manual, freeMode: true,
    methods: Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label })),
  });
}

export async function getReceiving(req, res) {
  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: me(req) }, select: { payoutKey: true, payoutKeyType: true, taxHolderName: true, acceptedPaymentMethods: true } });
    res.set('Cache-Control', 'no-store').json({
      pixKeyType: settings?.payoutKeyType ?? null, pixKey: settings?.payoutKey ?? null, holderName: settings?.taxHolderName ?? null,
      methods: parseAcceptedMethods(settings?.acceptedPaymentMethods ?? 'pix'),
    });
  } catch (err) { fail(res, err, 'payments.getReceiving'); }
}

export async function putReceiving(req, res) {
  try {
    const { pix_key_type: type, pix_key: key, methods } = req.body;
    await saveReceivingSettings(me(req), { pixKeyType: type ?? null, pixKey: key ? normalizePayoutKey(type, key) : null, methods });
    await getReceiving(req, res);
  } catch (err) { fail(res, err, 'payments.putReceiving'); }
}

export async function mine(req, res) {
  try {
    const role = req.query.role === 'professional' ? 'professional' : 'client';
    const status = ['pending', 'reported', 'confirmed', 'cancelled', 'refunded'].includes(req.query.status) ? req.query.status : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    res.set('Cache-Control', 'no-store').json(await listPayments(me(req), role, { page, limit, status }));
  } catch (err) { fail(res, err, 'payments.mine'); }
}

export async function forOrder(req, res) {
  try { res.set('Cache-Control', 'no-store').json(await orderPaymentState(req.params.orderUuid, me(req))); } catch (err) { fail(res, err, 'payments.forOrder'); }
}

export async function start(req, res) {
  try { res.status(201).json(await startPayment(req.params.orderUuid, me(req), req.body.method)); } catch (err) { fail(res, err, 'payments.start'); }
}

export async function act(req, res) {
  try { res.json(await actOnPayment(req.params.uuid, me(req), req.params.action, req.body ?? {})); } catch (err) { fail(res, err, 'payments.act'); }
}

export async function receipt(req, res) {
  try { res.set('Cache-Control', 'no-store').json(await getReceipt(req.params.uuid, me(req))); } catch (err) { fail(res, err, 'payments.receipt'); }
}

/** Webhook do Mercado Pago. Sem login: a segurança está na assinatura, validada antes de qualquer outra coisa. */
export async function mercadoPagoWebhook(req, res) {
  try {
    const dataId = req.query['data.id'] ?? req.body?.data?.id;
    const result = await processMercadoPagoWebhook({ signature: req.get('x-signature'), requestId: req.get('x-request-id'), dataId });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err.status === 401 || err.status === 503) return res.status(err.status).json({ message: err.message });
    logger.error('payments.webhook', err);
    return res.status(500).json({ message: 'Erro ao processar.' });
  }
}
