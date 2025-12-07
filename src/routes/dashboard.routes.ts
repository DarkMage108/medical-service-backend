import { Router } from 'express';
import {
  getStats,
  getUpcomingContacts,
  dismissContact,
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
router.get('/activity-window', getActivityWindow);
router.get('/dismissed-logs', getAllDismissedLogs);
router.get('/documents', getAllDocuments);

export default router;
