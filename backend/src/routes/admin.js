import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { resolveSchema } from '../validators/payoutValidator.js';
import { adminAlertList, adminDisputeList, adminOverview, adminPaymentList, adminResolve, adminWebhookList } from '../controllers/asaasController.js';

// Tudo aqui exige login e o papel "admin". Para criar um administrador: node scripts/grant-admin.mjs e-mail@exemplo.com
const router = Router();
router.use(authMiddleware, roleMiddleware('admin'), rateLimit({ limit: 300, windowMs: 10 * 60 * 1000 }));

router.get('/summary', adminOverview);
router.get('/payments', adminPaymentList);
router.get('/disputes', adminDisputeList);
router.post('/disputes/:id/resolve', validate(resolveSchema), adminResolve);
router.get('/alerts', adminAlertList);
router.get('/webhook-events', adminWebhookList);

export default router;
