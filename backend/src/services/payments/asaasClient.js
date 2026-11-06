// Cliente HTTP do Asaas. Só fala com a API; regras de negócio ficam em asaasProvider.js e nos serviços.
// Endpoints conferidos na documentação oficial (docs.asaas.com) em 06/11/2026. Veja o AUDITORIA.md.

const BASES = { sandbox: 'https://api-sandbox.asaas.com/v3', production: 'https://api.asaas.com/v3' };

export const asaasEnvironment = (env = process.env) => (env.ASAAS_ENV === 'production' ? 'production' : 'sandbox');
export const asaasBaseUrl = (env = process.env) => (env.ASAAS_BASE_URL || BASES[asaasEnvironment(env)]).replace(/\/$/, '');
export const asaasConfigured = (env = process.env) => !!(env.ASAAS_API_KEY && env.ASAAS_WEBHOOK_TOKEN && env.ASAAS_WEBHOOK_TOKEN.length >= 32);

export class AsaasError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * Chamada à API. `apiKey` padrão é a da plataforma; operações "da subconta" passam a chave dela.
 * Erros viram AsaasError com mensagem curta em português; o corpo do erro nunca vai para o log com dados de pagamento.
 */
export async function asaasRequest(method, path, { body, apiKey, env = process.env, idempotencyKey } = {}) {
  const key = apiKey ?? env.ASAAS_API_KEY;
  if (!key) throw new AsaasError(503, 'O gateway de pagamento não está configurado.');
  let response;
  try {
    response = await fetch(`${asaasBaseUrl(env)}${path}`, {
      method,
      headers: {
        access_token: key,
        'Content-Type': 'application/json',
        'User-Agent': 'Dommos',
        ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AsaasError(502, 'Não foi possível falar com o gateway de pagamento. Tente novamente.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const first = Array.isArray(data.errors) ? data.errors[0] : null;
    throw new AsaasError(response.status >= 500 ? 502 : 422, first?.description || `O gateway recusou a operação (HTTP ${response.status}).`, { status: response.status, code: first?.code });
  }
  return data;
}

// Operações usadas pelo sistema (uma função por endpoint, para os testes poderem simular cada uma).
export const asaas = {
  createCustomer: (payload, options) => asaasRequest('POST', '/customers', { body: payload, ...options }),
  createPayment: (payload, options) => asaasRequest('POST', '/payments', { body: payload, ...options }),
  getPayment: (id, options) => asaasRequest('GET', `/payments/${encodeURIComponent(id)}`, options),
  updatePaymentSplit: (id, split, options) => asaasRequest('PUT', `/lean/payments/${encodeURIComponent(id)}`, { body: { split }, ...options }),
  getPixQrCode: (id, options) => asaasRequest('GET', `/payments/${encodeURIComponent(id)}/pixQrCode`, options),
  cancelPayment: (id, options) => asaasRequest('DELETE', `/payments/${encodeURIComponent(id)}`, options),
  refundPayment: (id, payload, options) => asaasRequest('POST', `/payments/${encodeURIComponent(id)}/refund`, { body: payload, ...options }),
  createAccount: (payload, options) => asaasRequest('POST', '/accounts', { body: payload, ...options }),
  getAccountStatus: (apiKey, options) => asaasRequest('GET', '/myAccount/status/', { apiKey, ...options }),
  enableEscrow: (accountId, payload, options) => asaasRequest('POST', `/accounts/${encodeURIComponent(accountId)}/escrow`, { body: payload, ...options }),
  getPaymentEscrow: (paymentId, subaccountApiKey, options) => asaasRequest('GET', `/payments/${encodeURIComponent(paymentId)}/escrow`, { apiKey: subaccountApiKey, ...options }),
  finishEscrow: (escrowId, options) => asaasRequest('POST', `/escrow/${encodeURIComponent(escrowId)}/finish`, options),
  /** Só no sandbox: aprova uma subconta (chamado com a chave da conta principal). */
  sandboxApproveAccount: (accountId, options) => asaasRequest('POST', `/accounts/${encodeURIComponent(accountId)}/approve`, options),
  /** Só no sandbox: aprova a conta dona da chave usada (a subconta, com a chave dela). */
  sandboxApproveOwnAccount: (apiKey, options) => asaasRequest('POST', '/sandbox/myAccount/approve', { ...options, apiKey }),
  sandboxConfirmPayment: (id, options) => asaasRequest('POST', `/sandbox/payment/${encodeURIComponent(id)}/confirm`, options),
};

/** Status do Asaas -> status interno do pagamento. */
export const ASAAS_STATUS = {
  PENDING: 'pending', AWAITING_RISK_ANALYSIS: 'pending',
  CONFIRMED: 'confirmed', RECEIVED: 'confirmed', RECEIVED_IN_CASH: 'confirmed',
  OVERDUE: 'expired',
  REFUNDED: 'refunded', REFUND_REQUESTED: 'confirmed', REFUND_IN_PROGRESS: 'confirmed',
  CHARGEBACK_REQUESTED: 'chargeback', CHARGEBACK_DISPUTE: 'chargeback', AWAITING_CHARGEBACK_REVERSAL: 'chargeback',
};
