import { Router } from 'express';
import { getUser, updateUser, deleteUser } from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { updateUserSchema } from '../validators/userValidator.js';
import { readPersonal, updatePersonal, contactAction } from '../controllers/personalSettingsController.js';
import { contactRateLimit } from '../middleware/contactRateLimit.js';

const router = Router();
router.get('/me/personal', authMiddleware, readPersonal);
router.patch('/me/personal/:section', authMiddleware, updatePersonal);
router.post('/me/contact/:type/:action', authMiddleware, contactRateLimit, contactAction);

router.get('/:uuid', getUser);
router.patch('/:uuid', authMiddleware, validate(updateUserSchema), updateUser);
router.delete('/:uuid', authMiddleware, deleteUser);

export default router;
