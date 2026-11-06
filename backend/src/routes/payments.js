import { Router } from 'express';
import { z } from 'zod';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { receivingSchema } from '../validators/areaValidator.js';
import { config, getReceiving, putReceiving, mine, forOrder, start, act, receipt, mercadoPagoWebhook } from '../controllers/paymentController.js';

const router = Router();

// Webhook: público, mas só aceita notificações com assinatura válida do provedor.
router.post('/webhook/mercadopago', rateLimit({ limit: 300, windowMs: 60 * 1000, key: (req) => req.ip }), mercadoPagoWebhook);

router.use(authMiddleware);

const startSchema = z.object({ method: z.enum(['pix', 'cash', 'card_in_person'], { error: 'Escolha uma forma de pagamento.' }) });
const actionLimit = rateLimit({ limit: 60, windowMs: 10 * 60 * 1000, message: 'Muitas ações de pagamento em pouco tempo. Aguarde um pouco.' });

router.get('/config', config);
router.get('/receiving', getReceiving);
router.put('/receiving', validate(receivingSchema), putReceiving);
router.get('/mine', mine);
router.get('/order/:orderUuid', forOrder);
router.post('/order/:orderUuid', actionLimit, validate(startSchema), start);
router.get('/:uuid/receipt', receipt);
router.post('/:uuid/:action', actionLimit, act);

export default router;
