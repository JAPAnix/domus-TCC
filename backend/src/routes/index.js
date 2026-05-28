import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import professionalRoutes from './professionals.js';
import serviceRoutes from './services.js';
import proposalRoutes from './proposals.js';
import reviewRoutes from './reviews.js';
import categoryRoutes from './categories.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/professionals', professionalRoutes);
router.use(serviceRoutes);        // já tem /services/:uuid/proposals embutido
router.use(proposalRoutes);       // já tem /proposals/:uuid
router.use(reviewRoutes);         // já tem /services/:uuid/reviews e /users/:uuid/reviews
router.use('/categories', categoryRoutes);

export default router;