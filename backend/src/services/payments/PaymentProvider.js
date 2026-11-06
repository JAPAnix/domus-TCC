/**
 * Contrato único dos provedores de pagamento. Para trocar de provedor, implemente esta interface em um novo
 * arquivo desta pasta e registre-o em index.js: nenhuma tela nem rota precisa mudar.
 *
 * Todos os métodos recebem o registro `payment` (linha do banco) e devolvem só dados simples.
 * Nenhum provedor recebe nem guarda dados de cartão.
 */
export class PaymentProvider {
  /** Identificador gravado em payments.provider. */
  get name() { throw new Error('não implementado'); }

  /** true: cliente e profissional confirmam à mão. false: o provedor informa o status (webhook). */
  get manual() { return true; }

  /** Cria a cobrança. Retorna { externalId?, pixPayload? }. */
  async createCharge() { throw new Error('não implementado'); }

  /** Consulta o status no provedor. Retorna 'pending' | 'confirmed' | 'cancelled' | 'refunded'. */
  async getStatus() { throw new Error('não implementado'); }

  /** Confirma o recebimento. Retorna { status: 'confirmed' }. */
  async confirm() { throw new Error('não implementado'); }

  /** Cancela uma cobrança ainda não paga. */
  async cancel() { throw new Error('não implementado'); }

  /** Estorna um pagamento confirmado. */
  async refund() { throw new Error('não implementado'); }
}
