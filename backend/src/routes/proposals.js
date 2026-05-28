import { Router } from 'express';
import {
  createProposal, listProposals,
  getProposal, updateProposalStatus
} from '../controllers/proposalController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createProposalSchema, updateProposalStatusSchema } from '../validators/proposalValidator.js';

const router = Router();

router.post('/services/:uuid/proposals', authMiddleware, roleMiddleware('professional'), validate(createProposalSchema), createProposal);
router.get('/services/:uuid/proposals', authMiddleware, roleMiddleware('client'), listProposals);
router.get('/proposals/:uuid', authMiddleware, getProposal);
router.patch('/proposals/:uuid/status', authMiddleware, validate(updateProposalStatusSchema), updateProposalStatus);

export default router;