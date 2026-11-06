import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { readPersonal, updatePersonal, contactAction } from '../controllers/personalSettingsController.js';
import { contactRateLimit } from '../middleware/contactRateLimit.js';

const router = Router();
router.get('/me/personal', authMiddleware, readPersonal);
router.patch('/me/personal/:section', authMiddleware, updatePersonal);
router.post('/me/contact/:type/:action', authMiddleware, contactRateLimit, contactAction);


export default router;
