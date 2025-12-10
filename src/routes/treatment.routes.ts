import { Router } from 'express';
import {
  getTreatments,
  getTreatment,
  createTreatment,
  updateTreatment,
  deleteTreatment,
  getAdherenceReport,
} from '../controllers/treatment.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getTreatments);
router.get('/:id', getTreatment);
router.get('/:id/adherence-report', getAdherenceReport);
router.post('/', createTreatment);
router.patch('/:id', updateTreatment);
router.delete('/:id', deleteTreatment);

export default router;
