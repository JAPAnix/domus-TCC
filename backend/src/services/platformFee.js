import { asaasActive } from './payoutAccounts.js';
import { feeConfig } from '../config/fees.js';

export const platformFeePercent = () => {
  // Com o pagamento pela plataforma, a comissão do profissional vem da configuração central de taxas.
  if (asaasActive()) return feeConfig().proCommissionPercent;
  const fee = Number(process.env.PLATFORM_FEE_PERCENT ?? 0);
  return Number.isFinite(fee) && fee >= 0 && fee < 100 ? fee : 0;
};
