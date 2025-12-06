import { Router } from 'express';
import {
  getTreatments,
  getTreatment,
  createTreatment,
  updateTreatment,
  deleteTreatment,
} from '../controllers/treatment.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getTreatments);
router.get('/:id', getTreatment);
router.post('/', createTreatment);
router.patch('/:id', updateTreatment);
router.delete('/:id', deleteTreatment);

export default router;
