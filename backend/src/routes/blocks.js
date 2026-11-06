import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { blockSchema } from '../validators/areaValidator.js';
import { listBlocks, addBlock, removeBlock } from '../controllers/blockController.js';

const router = Router();
router.use(authMiddleware);
router.get('/', listBlocks);
router.post('/', validate(blockSchema), addBlock);
router.delete('/:uuid', removeBlock);

export default router;
