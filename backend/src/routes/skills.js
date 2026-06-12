import { Router } from 'express';
import { listSkills } from '../controllers/skillController.js';

const router = Router();

router.get('/', listSkills);

export default router;