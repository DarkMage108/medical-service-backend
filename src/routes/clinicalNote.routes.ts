import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as clinicalNoteController from '../controllers/clinicalNote.controller.js';

const router = Router();

router.use(authenticate);

// GET /api/patients/:patientId/clinical-notes
router.get('/patients/:patientId/clinical-notes', clinicalNoteController.getByPatient);

// POST /api/patients/:patientId/clinical-notes
router.post('/patients/:patientId/clinical-notes', clinicalNoteController.create);

// PATCH /api/clinical-notes/:id
router.patch('/clinical-notes/:id', clinicalNoteController.update);

// DELETE /api/clinical-notes/:id
router.delete('/clinical-notes/:id', clinicalNoteController.remove);

export default router;
