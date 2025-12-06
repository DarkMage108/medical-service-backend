import { Router } from 'express';
import {
  getMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication,
} from '../controllers/medication.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getMedications);
router.get('/:id', getMedication);
router.post('/', isAdmin, createMedication);
router.patch('/:id', isAdmin, updateMedication);
router.delete('/:id', isAdmin, deleteMedication);

export default router;
