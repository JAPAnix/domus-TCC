import { Router } from 'express';
import authMiddleware, { optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { profileSchema } from '../validators/areaValidator.js';
import { getMyProfile, updateMyProfile, listConnections, myWrittenReviews, getPublicProfile, publicWrittenReviews } from '../controllers/profileController.js';

const router = Router();

router.get('/me', authMiddleware, getMyProfile);
router.patch('/me', authMiddleware, validate(profileSchema), updateMyProfile);
router.get('/me/connections', authMiddleware, listConnections);
router.get('/me/reviews-written', authMiddleware, myWrittenReviews);
router.get('/:uuid', optionalAuth, getPublicProfile);
router.get('/:uuid/reviews-written', optionalAuth, publicWrittenReviews);

export default router;
