import { Router } from 'express';
import {
  getDoses,
  getDose,
  createDose,
  updateDose,
  deleteDose,
  updateSurvey,
} from '../controllers/dose.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getDoses);
router.get('/:id', getDose);
router.post('/', createDose);
router.patch('/:id', updateDose);
router.delete('/:id', deleteDose);
router.patch('/:id/survey', updateSurvey);

export default router;
