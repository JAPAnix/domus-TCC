import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { favoriteListSchema, favoriteItemSchema } from '../validators/areaValidator.js';
import { overview, showList, createList, renameList, deleteList, status, itemLists, saveItem, recordView } from '../controllers/favoritesController.js';

const router = Router();
router.use(authMiddleware);

router.get('/', overview);
router.get('/status', status);
router.get('/item', itemLists);
router.put('/item', validate(favoriteItemSchema), saveItem);
router.post('/recent', recordView);
router.post('/lists', validate(favoriteListSchema), createList);
router.get('/lists/:id', showList);
router.patch('/lists/:id', validate(favoriteListSchema), renameList);
router.delete('/lists/:id', deleteList);

export default router;
