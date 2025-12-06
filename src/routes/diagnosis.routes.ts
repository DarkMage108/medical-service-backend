import { Router } from 'express';
import {
  getDiagnoses,
  getDiagnosis,
  createDiagnosis,
  updateDiagnosis,
  deleteDiagnosis,
} from '../controllers/diagnosis.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getDiagnoses);
router.get('/:id', getDiagnosis);
router.post('/', isAdmin, createDiagnosis);
router.patch('/:id', isAdmin, updateDiagnosis);
router.delete('/:id', isAdmin, deleteDiagnosis);

export default router;
