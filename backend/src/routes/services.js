import { Router } from 'express';
import {
  createService, listServices, listMyServices, getService,
  updateService, updateStatus, deleteService, draftGet, draftPut, draftDelete, renew, report
} from '../controllers/serviceController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createServiceSchema,
  updateServiceSchema,
  updateStatusSchema,
  draftSchema,
  renewSchema,
  reportSchema
} from '../validators/serviceValidator.js';
import { requireOpenRequests } from '../config/openRequests.js';
import { rateLimit } from '../middleware/rateLimit.js';

import { getServiceParticipation } from '../controllers/serviceParticipationController.js';

const router = Router();
router.get('/:uuid/participation', authMiddleware, getServiceParticipation);

router.get('/draft', authMiddleware, requireOpenRequests, draftGet);
router.put('/draft', authMiddleware, requireOpenRequests, rateLimit({ limit: 120, windowMs: 60 * 60 * 1000 }), validate(draftSchema), draftPut);
router.delete('/draft', authMiddleware, requireOpenRequests, draftDelete);
router.post('/', authMiddleware, roleMiddleware('client'), requireOpenRequests, validate(createServiceSchema), createService);
router.get('/', requireOpenRequests, listServices);
router.get('/mine', authMiddleware, listMyServices);
router.post('/:uuid/renew', authMiddleware, requireOpenRequests, validate(renewSchema), renew);
router.post('/:uuid/report', authMiddleware, requireOpenRequests, rateLimit({ limit: 20, windowMs: 60 * 60 * 1000, message: 'Você fez muitas denúncias em pouco tempo.' }), validate(reportSchema), report);
router.get('/:uuid', getService);
router.patch('/:uuid', authMiddleware, roleMiddleware('client'), validate(updateServiceSchema), updateService);
router.patch('/:uuid/status', authMiddleware, roleMiddleware('client'), validate(updateStatusSchema), updateStatus);
router.delete('/:uuid', authMiddleware, roleMiddleware('client'), deleteService);

export default router;