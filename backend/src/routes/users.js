import { Router } from 'express';
import { getUser, updateUser, deleteUser } from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { updateUserSchema } from '../validators/userValidator.js';

const router = Router();

router.get('/:uuid', getUser);
router.patch('/:uuid', authMiddleware, validate(updateUserSchema), updateUser);
router.delete('/:uuid', authMiddleware, deleteUser);

export default router;