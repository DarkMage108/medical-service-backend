import { Router } from 'express';
import {
  getPurchaseRequests,
  checkPurchaseTriggers,
  updatePurchaseRequest,
  deletePurchaseRequest,
} from '../controllers/purchaseRequest.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getPurchaseRequests);
router.post('/check', checkPurchaseTriggers);
router.patch('/:id', updatePurchaseRequest);
router.delete('/:id', deletePurchaseRequest);

export default router;
