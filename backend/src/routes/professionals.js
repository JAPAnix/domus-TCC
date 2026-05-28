import { Router } from 'express';
import {
  createProfile, getProfile,
  updateProfile, updateAvailability
} from '../controllers/professionalController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createProfileSchema,
  updateProfileSchema,
  updateAvailabilitySchema
} from '../validators/professionalValidator.js';

const router = Router();

router.post('/', authMiddleware, validate(createProfileSchema), createProfile);
router.get('/:uuid', getProfile);
router.patch('/:uuid', authMiddleware, validate(updateProfileSchema), updateProfile);
router.patch('/:uuid/availability', authMiddleware, validate(updateAvailabilitySchema), updateAvailability);

export default router;