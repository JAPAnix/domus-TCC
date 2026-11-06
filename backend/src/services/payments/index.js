import { ManualProvider } from './manualProvider.js';
import { MercadoPagoProvider, mercadoPagoConfigured } from './mercadopagoProvider.js';

const manual = new ManualProvider();
let mercadopago = null;

export const providerByName = (name) => {
  if (name === 'mercadopago') return (mercadopago ??= new MercadoPagoProvider());
  return manual;
};

/** Provedor das cobranças novas. Sem configuração completa, volta sempre ao pagamento direto (gratuito). */
export function activeProvider() {
  if (process.env.PAYMENT_PROVIDER === 'mercadopago' && mercadoPagoConfigured()) return providerByName('mercadopago');
  return manual;
}

export const automaticPixEnabled = () => activeProvider().name === 'mercadopago';
