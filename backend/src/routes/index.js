import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import professionalRoutes from './professionals.js';
import serviceRoutes from './services.js';
import proposalRoutes from './proposals.js';
import categoryRoutes from './categories.js';
import { userReviewRouter, serviceReviewRouter } from './reviews.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/professionals', professionalRoutes);
router.use('/services', serviceRoutes);
router.use('/services', proposalRoutes);
router.use('/proposals', proposalRoutes);
router.use('/services', serviceReviewRouter);
router.use('/users', userReviewRouter);

export default router;