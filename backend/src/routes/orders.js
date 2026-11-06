import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { bookingSchema } from '../validators/listingValidator.js';
import { createReviewSchema } from '../validators/reviewValidator.js';
import { create, myOrders, getOrder, act, reviewContext, review } from '../controllers/orderController.js';

const router = Router();
router.use(authMiddleware);

const bookingLimit = rateLimit({ limit: 20, windowMs: 60 * 60 * 1000, message: 'Você fez muitos pedidos em pouco tempo. Aguarde um pouco.' });

router.post('/', bookingLimit, validate(bookingSchema), create);
router.get('/mine', myOrders);
router.get('/:uuid', getOrder);
router.get('/:uuid/review-context', reviewContext);
router.post('/:uuid/reviews', validate(createReviewSchema), review);
router.post('/:uuid/:action', act);

export default router;
