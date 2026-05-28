import { Router } from 'express';
import {
  createReview,
  listReviewsByUser,
  listReviewsByService
} from '../controllers/reviewController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/services/:uuid/reviews', authMiddleware, createReview);
router.get('/users/:uuid/reviews', listReviewsByUser);
router.get('/services/:uuid/reviews', listReviewsByService);

export default router;