import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { privacySchema, notificationsSchema, cookiesSchema, localeSchema, taxSchema } from '../validators/areaValidator.js';
import { getSettings, updatePrivacy, updateNotifications, updateCookies, updateLocale, updateTax, clearTax } from '../controllers/settingsController.js';

const router = Router();
router.use(authMiddleware);

router.get('/', getSettings);
router.patch('/privacy', validate(privacySchema), updatePrivacy);
router.patch('/notifications', validate(notificationsSchema), updateNotifications);
router.patch('/cookies', validate(cookiesSchema), updateCookies);
router.patch('/locale', validate(localeSchema), updateLocale);
router.put('/tax', validate(taxSchema), updateTax);
router.delete('/tax', clearTax);

export default router;
