import { Router } from 'express';
import {
  getStats,
  getUpcomingContacts,
  dismissContact,
  createManualContact,
  updateDismissedLogFeedback,
  resolveFeedback,
  getActivityWindow,
  getAllDismissedLogs,
  getAllDocuments,
} from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/stats', getStats);
router.get('/upcoming-contacts', getUpcomingContacts);
router.post('/dismiss-contact', dismissContact);
router.post('/manual-contact', createManualContact);
router.patch('/dismissed-logs/:contactId/feedback', updateDismissedLogFeedback);
router.post('/dismissed-logs/:contactId/resolve', resolveFeedback);
router.get('/activity-window', getActivityWindow);
router.get('/dismissed-logs', getAllDismissedLogs);
router.get('/documents', getAllDocuments);

export default router;
