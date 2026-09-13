import { Router } from 'express';
import { listServiceCatalog } from '../controllers/serviceCatalogController.js';

const router = Router();

router.get('/', listServiceCatalog);

export default router;
