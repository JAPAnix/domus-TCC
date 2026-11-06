import { PaymentProvider } from './PaymentProvider.js';
import { ASAAS_STATUS, AsaasError, asaas } from './asaasClient.js';
import { fromCents, splitNet, toCents } from '../../utils/money.js';
import { onlyDigits } from '../../utils/taxDocument.js';

const BILLING = { pix: 'PIX', credit_card: 'CREDIT_CARD', boleto: 'BOLETO' };
const reais = (cents) => Number(fromCents(cents).toFixed(2));
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Situação cadastral do Asaas -> nossa: pending (em análise), approved ou rejected. */
export function mapAccountStatus(status) {
  if (status?.general === 'APPROVED') return 'approved';
  if (status?.general === 'REJECTED' || [status?.commercialInfo, status?.bankAccountInfo, status?.documentation].includes('REJECTED')) return 'rejected';
  return 'pending';
}

/**
 * Pagamento pela plataforma com o Asaas: cobrança com split, custódia (Conta Escrow) e estorno.
 * O cartão nunca passa pelo nosso servidor: o cliente paga na página hospedada do Asaas (`invoiceUrl`).
 */
export class AsaasProvider extends PaymentProvider {
  get name() { return 'asaas'; }
  get manual() { return false; }

  /** Cria a subconta do profissional e liga a garantia. A apiKey só aparece nesta resposta: quem chama precisa guardá-la cifrada. */
  async createReceivingAccount(data, { escrowDays, env } = {}) {
    const created = await asaas.createAccount({
      name: data.name, email: data.email, cpfCnpj: onlyDigits(data.cpfCnpj), mobilePhone: onlyDigits(data.mobilePhone),
      incomeValue: data.incomeValue, address: data.address, addressNumber: data.addressNumber, province: data.province, postalCode: onlyDigits(data.postalCode),
      ...(data.complement && { complement: data.complement }), ...(data.birthDate && { birthDate: data.birthDate }),
      ...(data.companyType && { companyType: data.companyType }),
    }, { env });
    const apiKey = created.apiKey ?? created.accessToken?.apiKey;
    if (!created.id || !created.walletId || !apiKey) throw new AsaasError(502, 'O gateway não devolveu os dados da conta de recebimento.');
    let escrowEnabled = false;
    if (escrowDays) try {
      await asaas.enableEscrow(created.id, { enabled: true, daysToExpire: escrowDays, isFeePayer: false }, { env });
      escrowEnabled = true;
    } catch { /* a conta existe; a garantia pode ser ligada depois ("Atualizar status") */ }
    return { accountId: created.id, walletId: created.walletId, apiKey, escrowEnabled };
  }

  async getReceivingStatus(apiKey, { env } = {}) {
    const status = await asaas.getAccountStatus(apiKey, { env });
    return { status: mapAccountStatus(status), detail: { commercialInfo: status.commercialInfo, bankAccountInfo: status.bankAccountInfo, documentation: status.documentation, general: status.general } };
  }

  /**
   * Cria a cobrança com split. `amounts` vem de computeCheckout. Se a taxa do gateway for do profissional,
   * o split é recalculado com o netValue real; se isso falhar, a cobrança é cancelada (nunca fica com divisão errada).
   */
  async createCharge({ payment, order, payer, receiver, method, installments = 1, amounts, gatewayFeePayer = 'professional', env }) {
    if (!BILLING[method]) throw new AsaasError(400, 'Forma de pagamento indisponível.');
    const customerId = payer.customerId ?? (await asaas.createCustomer({ name: payer.name, cpfCnpj: onlyDigits(payer.cpfCnpj), email: payer.email, externalReference: payer.externalReference }, { env })).id;
    const body = {
      customer: customerId, billingType: BILLING[method], dueDate: tomorrow(), description: String(order.titleSnapshot).slice(0, 200),
      externalReference: payment.uuidText,
      split: [{ walletId: receiver.walletId, fixedValue: reais(amounts.proGrossCents) }],
      ...(method === 'credit_card' && installments > 1 ? { installmentCount: installments, totalValue: reais(amounts.totalCents) } : { value: reais(amounts.totalCents) }),
    };
    const created = await asaas.createPayment(body, { env, idempotencyKey: payment.uuidText });
    let proShareCents = amounts.proGrossCents;
    let platformShareCents = amounts.platformGrossCents;
    let netCents = null;
    try {
      if (created.netValue != null) {
        netCents = toCents(created.netValue);
        ({ proShareCents, platformShareCents } = splitNet({ netCents, proGrossCents: amounts.proGrossCents, platformGrossCents: amounts.platformGrossCents, gatewayFeePayer }));
        if (proShareCents !== amounts.proGrossCents) await asaas.updatePaymentSplit(created.id, [{ walletId: receiver.walletId, fixedValue: reais(proShareCents) }], { env });
      }
    } catch (error) {
      await asaas.cancelPayment(created.id, { env }).catch(() => {});
      throw error instanceof AsaasError ? error : new AsaasError(502, 'Não foi possível definir a divisão do pagamento.');
    }
    let pix = null;
    if (method === 'pix') pix = await asaas.getPixQrCode(created.id, { env });
    return {
      customerId, externalId: created.id, pixPayload: pix?.payload ?? null, pixImage: pix?.encodedImage ?? null,
      expiresAt: pix?.expirationDate ? new Date(String(pix.expirationDate).replace(' ', 'T')) : null,
      invoiceUrl: method === 'pix' ? null : created.invoiceUrl ?? null, netCents, proShareCents, platformShareCents,
    };
  }

  async getStatus(payment, { env } = {}) {
    const remote = await asaas.getPayment(payment.externalId, { env });
    return ASAAS_STATUS[remote.status] ?? 'pending';
  }

  async cancel(payment, { env } = {}) {
    await asaas.cancelPayment(payment.externalId, { env });
    return { status: 'cancelled' };
  }

  /** Estorno total (sem `cents`) ou parcial. As taxas do Asaas não voltam. */
  async refund(payment, { cents, reason, env } = {}) {
    await asaas.refundPayment(payment.externalId, { ...(cents != null && { value: reais(cents) }), description: String(reason ?? 'Estorno').slice(0, 200) }, { env });
    return { status: cents != null && cents < toCents(payment.amount) ? 'partially_refunded' : 'refunded' };
  }

  /** Libera a garantia para o profissional. Seguro repetir: se já foi liberada, não faz nada. */
  async releaseEscrow(payment, subaccountApiKey, { env } = {}) {
    const escrow = await asaas.getPaymentEscrow(payment.externalId, subaccountApiKey, { env });
    if (!escrow.id) throw new AsaasError(502, 'Garantia não encontrada para esta cobrança.');
    if (escrow.status === 'DONE') return { escrowId: escrow.id, alreadyReleased: true };
    await asaas.finishEscrow(escrow.id, { env });
    return { escrowId: escrow.id, alreadyReleased: false };
  }
}
