import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  changePasswordSchema, passwordConfirmSchema, googleLinkSchema, deleteConfirmSchema,
} from '../validators/areaValidator.js';
import {
  changePassword, linkGoogle, unlinkGoogle, listSessions, revokeSession, revokeOtherSessions,
  deactivateAccount, startDeleteAccount, confirmDeleteAccount, exportData,
} from '../controllers/accountController.js';
import { prefill } from '../controllers/prefillController.js';

const router = Router();
router.use(authMiddleware);

const sensitive = rateLimit({ limit: 10, windowMs: 15 * 60 * 1000, message: 'Muitas tentativas. Aguarde alguns minutos.' });
const exports_ = rateLimit({ limit: 5, windowMs: 60 * 60 * 1000, message: 'Você já pediu seus dados várias vezes. Tente novamente mais tarde.' });

router.patch('/password', sensitive, validate(changePasswordSchema), changePassword);
router.post('/google', sensitive, validate(googleLinkSchema), linkGoogle);
router.delete('/google', unlinkGoogle);
router.get('/prefill', prefill);
router.get('/sessions', listSessions);
router.delete('/sessions', revokeOtherSessions);
router.delete('/sessions/:id', revokeSession);
router.post('/deactivate', sensitive, validate(passwordConfirmSchema), deactivateAccount);
router.post('/delete/start', sensitive, validate(passwordConfirmSchema), startDeleteAccount);
router.post('/delete/confirm', sensitive, validate(deleteConfirmSchema), confirmDeleteAccount);
router.get('/export', exports_, exportData);

export default router;
