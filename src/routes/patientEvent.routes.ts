import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getAllPatientEvents,
  getPatientEvents,
  createPatientEvent,
  updatePatientEvent,
  deletePatientEvent,
} from '../controllers/patientEvent.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/patient-events - Get all events (for dashboard)
router.get('/patient-events', getAllPatientEvents);

// GET /api/patients/:patientId/events - Get all events for a patient
router.get('/patients/:patientId/events', getPatientEvents);

// POST /api/patients/:patientId/events - Create a new event for a patient
router.post('/patients/:patientId/events', createPatientEvent);

// PATCH /api/patient-events/:id - Update an event
router.patch('/patient-events/:id', updatePatientEvent);

// DELETE /api/patient-events/:id - Delete an event
router.delete('/patient-events/:id', deletePatientEvent);

export default router;
