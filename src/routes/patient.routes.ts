import { Router } from 'express';
import {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  recalculatePatientStatus,
  getGuardian,
  updateGuardian,
  getAddress,
  upsertAddress,
  deleteAddress,
  getDocuments,
  uploadDocument,
  deleteDocument,
} from '../controllers/patient.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Patient routes
router.get('/', getPatients);
router.get('/:id', getPatient);
router.post('/', createPatient);
router.patch('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.patch('/:id/recalculate-status', recalculatePatientStatus);

// Guardian routes
router.get('/:patientId/guardian', getGuardian);
router.patch('/:patientId/guardian', updateGuardian);

// Address routes
router.get('/:patientId/address', getAddress);
router.put('/:patientId/address', upsertAddress);
router.delete('/:patientId/address', deleteAddress);

// Document routes
router.get('/:patientId/documents', getDocuments);
router.post('/:patientId/documents', uploadDocument);
router.delete('/documents/:documentId', deleteDocument);

export default router;
