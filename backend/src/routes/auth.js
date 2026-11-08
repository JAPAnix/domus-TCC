import { Router } from 'express';
import { register, login, me, forgotPassword, resetPassword, googleLogin } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { byIpAndEmail, rateLimit } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, googleSchema } from '../validators/authValidator.js';

const router = Router();

const loginLimit = rateLimit({ limit: 10, windowMs: 15 * 60 * 1000, key: byIpAndEmail, message: 'Muitas tentativas de entrada. Aguarde alguns minutos e tente de novo.' });
const registerLimit = rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, key: (req) => req.ip, message: 'Muitos cadastros deste endereço. Tente novamente mais tarde.' });
const recoveryLimit = rateLimit({ limit: 5, windowMs: 60 * 60 * 1000, key: byIpAndEmail, message: 'Muitos pedidos de recuperação. Tente novamente mais tarde.' });
const resetLimit = rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, key: (req) => req.ip, message: 'Muitas tentativas. Tente novamente mais tarde.' });
const googleLimit = rateLimit({ limit: 20, windowMs: 15 * 60 * 1000, key: (req) => req.ip, message: 'Muitas tentativas de entrada. Aguarde alguns minutos.' });

router.post('/register', registerLimit, validate(registerSchema), register);
router.post('/login', loginLimit, validate(loginSchema), login);
router.post('/forgot-password', recoveryLimit, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', resetLimit, validate(resetPasswordSchema), resetPassword);
router.post('/google', googleLimit, validate(googleSchema), googleLogin);
router.get('/me', authMiddleware, me);

export default router;
