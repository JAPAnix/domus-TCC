import { Router } from 'express';
import {
  createReview,
  listReviewsByUser,
  listReviewsByService
} from '../controllers/reviewController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const userReviewRouter = Router();
const serviceReviewRouter = Router();

userReviewRouter.get('/:uuid/reviews', listReviewsByUser);

serviceReviewRouter.post('/:uuid/reviews', authMiddleware, createReview);
serviceReviewRouter.get('/:uuid/reviews', listReviewsByService);

export { userReviewRouter, serviceReviewRouter };