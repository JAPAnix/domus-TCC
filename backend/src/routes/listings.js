import { Router } from 'express';
import { z } from 'zod';
import authMiddleware, { optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { listingConfig, searchListings, getPublicListing, getListingReviews, postListingReport, reportReasons } from '../controllers/listingController.js';

const router = Router();

const reportSchema = z.object({
  reason: z.enum(['scam', 'inappropriate', 'wrong_info', 'duplicate', 'other'], { error: 'Escolha o motivo da denúncia.' }),
  details: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional(),
});

router.get('/config', listingConfig);
router.get('/report-reasons', reportReasons);
router.get('/search', optionalAuth, searchListings);
router.get('/:uuid', optionalAuth, getPublicListing);
router.get('/:uuid/reviews', getListingReviews);
router.post('/:uuid/report', authMiddleware, rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, message: 'Você fez muitas denúncias em pouco tempo.' }), validate(reportSchema), postListingReport);

export default router;
