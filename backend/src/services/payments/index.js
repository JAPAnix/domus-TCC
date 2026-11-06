import { ManualProvider } from './manualProvider.js';
import { MercadoPagoProvider, mercadoPagoConfigured } from './mercadopagoProvider.js';
import { AsaasProvider } from './asaasProvider.js';

const manual = new ManualProvider();
let mercadopago = null;
let asaasProvider = null;

export const providerByName = (name) => {
  if (name === 'mercadopago') return (mercadopago ??= new MercadoPagoProvider());
  // Registrado, mas ainda não escolhido por activeProvider(): falta ligar ao fluxo do pedido (ver AUDITORIA.md, rodada 5).
  if (name === 'asaas') return (asaasProvider ??= new AsaasProvider());
  return manual;
};

/** Provedor das cobranças novas. Sem configuração completa, volta sempre ao pagamento direto (gratuito). */
export function activeProvider() {
  if (process.env.PAYMENT_PROVIDER === 'mercadopago' && mercadoPagoConfigured()) return providerByName('mercadopago');
  return manual;
}

export const automaticPixEnabled = () => activeProvider().name === 'mercadopago';
