import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { getProfessionalDashboard } from '../controllers/professionalDashboardController.js';

const router = Router();

// Propostas enviadas pelo profissional (aba "Propostas que enviei" em Pedidos).
router.get('/dashboard', authMiddleware, roleMiddleware('professional'), getProfessionalDashboard);

export default router;
