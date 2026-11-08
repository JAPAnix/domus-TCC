import test from 'node:test';
import assert from 'node:assert/strict';
import { toCents, fromCents, formatCents, percentOf, computeCheckout, splitNet, refundCents } from '../src/utils/money.js';
import { readFeeConfig } from '../src/config/fees.js';

test('conversão para centavos sem erro de ponto flutuante', () => {
  assert.equal(toCents('12,34'), 1234);
  assert.equal(toCents(12.34), 1234);
  assert.equal(toCents('1.234,50'), 123450);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(1.005), 101);
  assert.equal(toCents('150.00'.replace('.', ',')), 15000);
  assert.equal(toCents({ toString: () => '170.00' }), 17000);
  assert.equal(toCents(null), null);
  assert.throws(() => toCents('abc'));
  assert.equal(fromCents(1234), 12.34);
  assert.match(formatCents(123456), /1\.234,56/);
});

test('percentual arredonda meio para cima, uma vez por item', () => {
  assert.equal(percentOf(12345, 10), 1235); // 1234,5 sobe
  assert.equal(percentOf(12344, 10), 1234);
  assert.equal(percentOf(10000, 0), 0);
  assert.equal(percentOf(10000, 12.5), 1250);
  assert.equal(percentOf(333, 10), 33); // 33,3
  assert.equal(percentOf(335, 10), 34); // 33,5 sobe
  assert.equal(percentOf(1, 49), 0);
  assert.equal(percentOf(1, 50), 1);
  assert.throws(() => percentOf(10.5, 10));
  assert.throws(() => percentOf(-1, 10));
});

test('checkout: total do cliente e partes de cada lado', () => {
  const none = computeCheckout({ serviceCents: 17000, clientFeePercent: 0, proCommissionPercent: 10 });
  assert.deepEqual(none, { serviceCents: 17000, clientFeeCents: 0, totalCents: 17000, commissionCents: 1700, proGrossCents: 15300, platformGrossCents: 1700 });
  const withFee = computeCheckout({ serviceCents: 10000, clientFeePercent: 5, proCommissionPercent: 10 });
  assert.equal(withFee.totalCents, 10500);
  assert.equal(withFee.platformGrossCents, 500 + 1000);
  assert.equal(withFee.proGrossCents, 9000);
  // a soma das partes sempre fecha com o total pago
  for (const service of [1, 99, 333, 12345, 99999]) {
    const r = computeCheckout({ serviceCents: service, clientFeePercent: 3.5, proCommissionPercent: 12.5 });
    assert.equal(r.proGrossCents + r.platformGrossCents, r.totalCents);
  }
});

test('split do valor líquido: a soma é sempre o líquido', () => {
  const base = { proGrossCents: 15300, platformGrossCents: 1700 };
  // o profissional absorve a taxa do gateway (padrão)
  assert.deepEqual(splitNet({ ...base, netCents: 16892, gatewayFeePayer: 'professional' }), { proShareCents: 15192, platformShareCents: 1700 });
  // a plataforma absorve a taxa
  assert.deepEqual(splitNet({ ...base, netCents: 16892, gatewayFeePayer: 'platform' }), { proShareCents: 15300, platformShareCents: 1592 });
  // líquido menor que a parte da plataforma: o profissional não fica negativo
  assert.deepEqual(splitNet({ ...base, netCents: 1000, gatewayFeePayer: 'professional' }), { proShareCents: 0, platformShareCents: 1000 });
  for (const net of [0, 1, 500, 1700, 1701, 16999, 17000]) {
    for (const payer of ['professional', 'platform']) {
      const s = splitNet({ ...base, netCents: net, gatewayFeePayer: payer });
      assert.equal(s.proShareCents + s.platformShareCents, net);
      assert.ok(s.proShareCents >= 0 && s.platformShareCents >= 0);
    }
  }
  assert.throws(() => splitNet({ ...base, netCents: -1, gatewayFeePayer: 'platform' }));
});

test('reembolso conforme a política de cancelamento', () => {
  const total = 20000;
  assert.equal(refundCents({ totalCents: total, policy: 'flexible', hoursUntilService: 30, canceledBy: 'client' }), total);
  assert.equal(refundCents({ totalCents: total, policy: 'flexible', hoursUntilService: 10, canceledBy: 'client' }), 10000);
  assert.equal(refundCents({ totalCents: total, policy: 'moderate', hoursUntilService: 71, canceledBy: 'client' }), 10000);
  assert.equal(refundCents({ totalCents: total, policy: 'moderate', hoursUntilService: 72, canceledBy: 'client' }), total);
  assert.equal(refundCents({ totalCents: total, policy: 'strict', hoursUntilService: 100, canceledBy: 'client' }), 0 + 0 || 0);
  assert.equal(refundCents({ totalCents: total, policy: 'strict', hoursUntilService: 168, canceledBy: 'client' }), total);
  assert.equal(refundCents({ totalCents: total, policy: 'flexible', hoursUntilService: -5, canceledBy: 'client' }), 0);
  assert.equal(refundCents({ totalCents: total, policy: 'strict', hoursUntilService: 1, canceledBy: 'professional' }), total);
  assert.equal(refundCents({ totalCents: 20001, policy: 'flexible', hoursUntilService: 10, canceledBy: 'client' }), 10001);
});

test('configuração de taxas: padrões, validação e coerência dos prazos', () => {
  assert.deepEqual(readFeeConfig({}), { clientFeePercent: 0, proCommissionPercent: 10, gatewayFeePayer: 'professional', escrowDays: 14, autoConfirmDays: 7 });
  assert.equal(readFeeConfig({ PRO_COMMISSION_PERCENT: '12.5', GATEWAY_FEE_PAYER: 'platform' }).proCommissionPercent, 12.5);
  assert.throws(() => readFeeConfig({ PRO_COMMISSION_PERCENT: '90' }), /PRO_COMMISSION_PERCENT/);
  assert.throws(() => readFeeConfig({ CLIENT_FEE_PERCENT: '-1' }), /CLIENT_FEE_PERCENT/);
  assert.throws(() => readFeeConfig({ GATEWAY_FEE_PAYER: 'cliente' }), /GATEWAY_FEE_PAYER/);
  assert.throws(() => readFeeConfig({ ESCROW_DAYS: '5', AUTO_CONFIRM_DAYS: '7' }), /ESCROW_DAYS/);
  assert.throws(() => readFeeConfig({ ESCROW_DAYS: '10.5' }), /ESCROW_DAYS/);
});

test('valores quebrados (R$ 99,99): pago = repasse ao profissional + comissão da plataforma + taxa do gateway, em centavos exatos', () => {
  const cases = [
    { clientFeePercent: 0, proCommissionPercent: 10 }, { clientFeePercent: 5, proCommissionPercent: 10 }, { clientFeePercent: 3.5, proCommissionPercent: 12.5 }, { clientFeePercent: 0, proCommissionPercent: 0 },
  ];
  for (const rule of cases) {
    const split = computeCheckout({ serviceCents: toCents('99,99'), ...rule });
    assert.equal(split.serviceCents, 9999);
    assert.equal(split.totalCents, 9999 + split.clientFeeCents, 'o cliente paga o serviço mais a taxa de serviço');
    assert.equal(split.proGrossCents + split.commissionCents, 9999, 'serviço = parte do profissional + comissão');
    for (const gatewayFeeCents of [0, 99, 199, 399]) {
      for (const gatewayFeePayer of ['professional', 'platform']) {
        const net = split.totalCents - gatewayFeeCents;
        const shares = splitNet({ netCents: net, proGrossCents: split.proGrossCents, platformGrossCents: split.platformGrossCents, gatewayFeePayer });
        assert.equal(shares.proShareCents + shares.platformShareCents, net, `líquido fecha (${JSON.stringify(rule)}, taxa ${gatewayFeeCents}, ${gatewayFeePayer})`);
        assert.equal(shares.proShareCents + shares.platformShareCents + gatewayFeeCents, split.totalCents, 'pago = profissional + plataforma + gateway');
        assert.ok(shares.proShareCents >= 0 && shares.platformShareCents >= 0, 'nenhuma parte fica negativa');
      }
    }
  }
  // A conta que o cliente vê: R$ 99,99 de serviço com 10% de comissão deixa R$ 89,99 ao profissional e R$ 10,00 à plataforma.
  const base = computeCheckout({ serviceCents: 9999, clientFeePercent: 0, proCommissionPercent: 10 });
  assert.deepEqual([base.commissionCents, base.proGrossCents], [1000, 8999]);
});
