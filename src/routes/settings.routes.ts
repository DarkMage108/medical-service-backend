import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

// GET /settings - All settings (admin only)
router.get('/', authenticate, isAdmin, settingsController.getAll);

// GET /settings/adherence - Adherence settings (any authenticated user)
router.get('/adherence', authenticate, settingsController.getAdherenceSettings);

// PUT /settings - Update settings (admin only)
router.put('/', authenticate, isAdmin, settingsController.updateSettings);

export default router;
