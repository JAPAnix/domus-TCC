import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { listingDraftSchema, verificationSchema, availabilityToggleSchema } from '../validators/listingValidator.js';
import {
  myListings, createDraft, getOwnListing, updateListing, publishListing, pauseListing, duplicateListing, deleteListing,
} from '../controllers/listingController.js';
import { summary, earnings, availability, setBlockedDate, getVerification, saveVerification } from '../controllers/proController.js';
import { proOrders } from '../controllers/orderController.js';

const router = Router();
router.use(authMiddleware);

// Anúncios e verificação: qualquer conta pode criar rascunhos; o papel "profissional" nasce ao publicar o primeiro.
router.get('/listings', myListings);
router.post('/listings', createDraft);
router.get('/listings/:uuid', getOwnListing);
router.patch('/listings/:uuid', validate(listingDraftSchema), updateListing);
router.post('/listings/:uuid/publish', publishListing);
router.post('/listings/:uuid/pause', pauseListing);
router.post('/listings/:uuid/duplicate', duplicateListing);
router.delete('/listings/:uuid', deleteListing);
router.get('/verification', getVerification);
router.put('/verification', validate(verificationSchema), saveVerification);

// Painel, pedidos, ganhos e agenda: só para quem já é profissional.
router.get('/summary', roleMiddleware('professional'), summary);
router.get('/orders', roleMiddleware('professional'), proOrders);
router.get('/earnings', roleMiddleware('professional'), earnings);
router.get('/availability', roleMiddleware('professional'), availability);
router.put('/availability/:date', roleMiddleware('professional'), validate(availabilityToggleSchema), setBlockedDate);

export default router;
