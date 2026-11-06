import { Router } from 'express';
import { z } from 'zod';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { receivingSchema } from '../validators/areaValidator.js';
import { payoutAccountSchema, disputeSchema, startAsaasSchemaExtras } from '../validators/payoutValidator.js';
import { asaasWebhook, confirmServiceAction, createReceivingAccount, disputeAction, earnings, receivingAccount, refreshReceivingAccount, sandboxApproveAccount } from '../controllers/asaasController.js';
import { config, getReceiving, putReceiving, mine, forOrder, start, act, receipt, mercadoPagoWebhook } from '../controllers/paymentController.js';

const router = Router();

// Webhook: público, mas só aceita notificações com assinatura válida do provedor.
router.post('/webhook/asaas', rateLimit({ limit: 600, windowMs: 60 * 1000, key: (req) => req.ip }), asaasWebhook);
router.post('/webhook/mercadopago', rateLimit({ limit: 300, windowMs: 60 * 1000, key: (req) => req.ip }), mercadoPagoWebhook);

router.use(authMiddleware);

const startSchema = z.object({ method: z.enum(['pix', 'cash', 'card_in_person', 'credit_card', 'boleto'], { error: 'Escolha uma forma de pagamento.' }) }).extend(startAsaasSchemaExtras.shape);
const actionLimit = rateLimit({ limit: 60, windowMs: 10 * 60 * 1000, message: 'Muitas ações de pagamento em pouco tempo. Aguarde um pouco.' });

router.get('/config', config);
router.get('/receiving', getReceiving);
router.put('/receiving', validate(receivingSchema), putReceiving);
router.get('/mine', mine);
router.get('/order/:orderUuid', forOrder);
router.post('/order/:orderUuid', actionLimit, validate(startSchema), start);
// Pagamento pela plataforma (Asaas)
router.get('/receiving-account', receivingAccount);
router.post('/receiving-account', rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, message: 'Muitas tentativas de cadastro. Tente mais tarde.' }), validate(payoutAccountSchema), createReceivingAccount);
router.post('/receiving-account/refresh', rateLimit({ limit: 30, windowMs: 10 * 60 * 1000 }), refreshReceivingAccount);
router.post('/receiving-account/sandbox-approve', rateLimit({ limit: 10, windowMs: 10 * 60 * 1000 }), sandboxApproveAccount);
router.get('/earnings', earnings);
router.post('/:uuid/confirm-service', actionLimit, confirmServiceAction);
router.post('/:uuid/dispute', actionLimit, validate(disputeSchema), disputeAction);

router.get('/:uuid/receipt', receipt);
router.post('/:uuid/:action', actionLimit, act);

export default router;
