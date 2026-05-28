import { Router } from 'express';
import {
  createService, listServices, getService,
  updateService, updateStatus, deleteService
} from '../controllers/serviceController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createServiceSchema,
  updateServiceSchema,
  updateStatusSchema
} from '../validators/serviceValidator.js';

const router = Router();

router.post('/', authMiddleware, roleMiddleware('client'), validate(createServiceSchema), createService);
router.get('/', listServices);
router.get('/:uuid', getService);
router.patch('/:uuid', authMiddleware, roleMiddleware('client'), validate(updateServiceSchema), updateService);
router.patch('/:uuid/status', authMiddleware, roleMiddleware('client'), validate(updateStatusSchema), updateStatus);
router.delete('/:uuid', authMiddleware, roleMiddleware('client'), deleteService);

export default router;