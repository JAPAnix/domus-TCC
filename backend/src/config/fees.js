// Taxas e prazos da plataforma, em um lugar só. Mudar aqui (ou nas variáveis de ambiente) não exige mexer no código.
// O pagamento grava um "snapshot" destes valores na hora da contratação; pedidos antigos não mudam.

const number = (value, fallback, { min, max, integer = false, name }) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${name} inválido: use um ${integer ? 'inteiro' : 'número'} entre ${min} e ${max}.`);
  }
  return parsed;
};

export function readFeeConfig(env = process.env) {
  const gatewayFeePayer = env.GATEWAY_FEE_PAYER ?? 'professional';
  if (!['professional', 'platform'].includes(gatewayFeePayer)) throw new Error('GATEWAY_FEE_PAYER inválido: use "professional" ou "platform".');
  const config = {
    clientFeePercent: number(env.CLIENT_FEE_PERCENT, 0, { min: 0, max: 30, name: 'CLIENT_FEE_PERCENT' }),
    proCommissionPercent: number(env.PRO_COMMISSION_PERCENT, 10, { min: 0, max: 50, name: 'PRO_COMMISSION_PERCENT' }),
    gatewayFeePayer,
    escrowDays: number(env.ESCROW_DAYS, 14, { min: 1, max: 90, integer: true, name: 'ESCROW_DAYS' }),
    autoConfirmDays: number(env.AUTO_CONFIRM_DAYS, 7, { min: 1, max: 60, integer: true, name: 'AUTO_CONFIRM_DAYS' }),
  };
  // A garantia precisa durar mais que a confirmação automática, senão o valor seria liberado antes do prazo do cliente.
  if (config.escrowDays <= config.autoConfirmDays) throw new Error('ESCROW_DAYS precisa ser maior que AUTO_CONFIRM_DAYS.');
  return config;
}

export const feeConfig = () => readFeeConfig();
