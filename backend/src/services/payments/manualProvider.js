import { PaymentProvider } from './PaymentProvider.js';
import { buildPixBrCode } from '../../utils/pixBrCode.js';

/**
 * Pagamento direto combinado entre as partes (Pix, dinheiro ou cartão presencial). Gratuito e sem integração:
 * o dinheiro nunca passa pelo Dommos. O Pix usa um BR Code estático gerado aqui mesmo.
 */
export class ManualProvider extends PaymentProvider {
  get name() { return 'manual'; }
  get manual() { return true; }

  async createCharge({ payment, receiver }) {
    if (payment.method !== 'pix') return {};
    return { pixPayload: buildPixBrCode({ key: receiver.pixKey, name: receiver.name, city: receiver.city, amount: Number(payment.amount) }) };
  }

  async getStatus(payment) { return payment.status === 'reported' ? 'pending' : payment.status; }
  async confirm() { return { status: 'confirmed' }; }
  async cancel() { return { status: 'cancelled' }; }
  async refund() { return { status: 'refunded' }; }
}
