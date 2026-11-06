import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { openConversationSchema, sendMessageSchema, reportSchema, quickReplySchema, prefsSchema, feedbackSchema } from '../validators/messageValidator.js';
import * as c from '../controllers/messageController.js';

const router = Router();
router.use(authMiddleware);

const sendLimit = rateLimit({ limit: 40, windowMs: 60 * 1000, message: 'Você está enviando mensagens rápido demais. Aguarde um instante.' });
const openLimit = rateLimit({ limit: 30, windowMs: 60 * 60 * 1000, message: 'Você iniciou muitas conversas em pouco tempo. Aguarde um pouco.' });
const reportLimit = rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, message: 'Você fez muitas denúncias em pouco tempo.' });
const typingLimit = rateLimit({ limit: 60, windowMs: 60 * 1000 });

router.get('/', c.list);
router.post('/', openLimit, validate(openConversationSchema), c.open);
router.get('/unread-count', c.unread);
router.get('/prefs', c.prefsGet);
router.put('/prefs', validate(prefsSchema), c.prefsPut);
router.get('/:uuid', c.show);
router.post('/:uuid/messages', sendLimit, validate(sendMessageSchema), c.send);
router.post('/:uuid/read', c.read);
router.post('/:uuid/typing', typingLimit, c.typing);
router.post('/:uuid/archive', c.archive);
router.post('/:uuid/unarchive', c.unarchive);
router.post('/:uuid/report', reportLimit, validate(reportSchema), c.report);
router.get('/:uuid/replies', c.replies);

export const quickReplyRouter = Router();
quickReplyRouter.use(authMiddleware);
quickReplyRouter.get('/', c.quickList);
quickReplyRouter.post('/', validate(quickReplySchema), c.quickCreate);
quickReplyRouter.put('/:id', validate(quickReplySchema), c.quickUpdate);
quickReplyRouter.delete('/:id', c.quickDelete);

export const feedbackRouter = Router();
feedbackRouter.use(authMiddleware);
feedbackRouter.post('/', rateLimit({ limit: 5, windowMs: 60 * 60 * 1000, message: 'Você já enviou vários feedbacks. Obrigado! Tente de novo mais tarde.' }), validate(feedbackSchema), c.feedback);

export default router;
