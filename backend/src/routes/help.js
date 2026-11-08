import { Router } from 'express';
import authMiddleware, { optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { assistantQuestionSchema, assistantRatingSchema, feedbackSchema, ticketSchema } from '../validators/areaValidator.js';
import { sendFeedback, createTicket, myTickets, assistantQuestion, assistantRating } from '../controllers/helpController.js';

const router = Router();

const feedbackLimit = rateLimit({ limit: 40, windowMs: 60 * 60 * 1000, key: (req) => req.ip });
const ticketLimit = rateLimit({ limit: 5, windowMs: 60 * 60 * 1000, message: 'Você já enviou várias mensagens. Aguarde um pouco para enviar outra.', key: (req) => req.user?.uuid ?? req.ip });

// Assistente de ajuda: sem login, sem guardar quem perguntou. Só o texto limpo, o artigo mostrado e o "ajudou?".
const assistantLimit = rateLimit({ limit: 40, windowMs: 60 * 60 * 1000, message: 'Muitas perguntas em pouco tempo. Tente de novo mais tarde ou fale com o suporte.', key: (req) => req.ip });
router.post('/assistant/questions', assistantLimit, validate(assistantQuestionSchema), assistantQuestion);
router.post('/assistant/questions/:uuid/rating', assistantLimit, validate(assistantRatingSchema), assistantRating);
router.post('/feedback', optionalAuth, feedbackLimit, validate(feedbackSchema), sendFeedback);
router.post('/tickets', optionalAuth, ticketLimit, validate(ticketSchema), createTicket);
router.get('/tickets/mine', authMiddleware, myTickets);

export default router;
