import { Router } from 'express';
import { register, login, me, forgotPassword, resetPassword, googleLogin } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, googleSchema } from '../validators/authValidator.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/google', validate(googleSchema), googleLogin);
router.get('/me', authMiddleware, me);

export default router;
