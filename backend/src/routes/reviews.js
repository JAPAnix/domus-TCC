import { Router } from 'express';
import {
  createReview,
  listReviewsByUser,
  listReviewsByService
} from '../controllers/reviewController.js';
import authMiddleware from '../middleware/authMiddleware.js';

import { validate } from '../middleware/validateMiddleware.js';
import { createReviewSchema } from '../validators/reviewValidator.js';
import { getReviewContext, workflowHandler } from '../services/serviceWorkflow.js';

const userReviewRouter = Router();
const serviceReviewRouter = Router();

userReviewRouter.get('/:uuid/reviews', listReviewsByUser);

serviceReviewRouter.post('/:uuid/reviews', authMiddleware, validate(createReviewSchema), createReview);
serviceReviewRouter.get('/:uuid/reviews', listReviewsByService);
serviceReviewRouter.get('/:uuid/review-context', authMiddleware, workflowHandler(getReviewContext));

export { userReviewRouter, serviceReviewRouter };