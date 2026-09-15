import { Router } from 'express';
import {
  createProfile, getProfile, searchProfessionals,
  updateProfile, updateAvailability
} from '../controllers/professionalController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createProfileSchema,
  updateProfileSchema,
  updateAvailabilitySchema
} from '../validators/professionalValidator.js';

import roleMiddleware from '../middleware/roleMiddleware.js';
import { getProfessionalDashboard } from '../controllers/professionalDashboardController.js';

const router = Router();

router.get('/dashboard', authMiddleware, roleMiddleware('professional'), getProfessionalDashboard);

router.post('/', authMiddleware, validate(createProfileSchema), createProfile);
router.get('/search', searchProfessionals);
router.get('/:uuid', getProfile);
router.patch('/:uuid', authMiddleware, validate(updateProfileSchema), updateProfile);
router.patch('/:uuid/availability', authMiddleware, validate(updateAvailabilitySchema), updateAvailability);

export default router;
