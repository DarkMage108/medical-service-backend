import { Router } from 'express';
import {
  getMessageTemplates,
  getMessageTemplate,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  resolveTemplate,
} from '../controllers/messageTemplate.controller.js';
import { VARIABLE_DEFINITIONS } from '../services/messageVariables.service.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// List of supported variable tags (for the admin UI variable picker)
router.get('/variables', (_req, res) => {
  res.json({ data: VARIABLE_DEFINITIONS });
});

// Resolve template content with variables for a given treatment (used by message popup)
router.post('/resolve', resolveTemplate);

router.get('/', getMessageTemplates);
router.get('/:id', getMessageTemplate);
router.post('/', isAdmin, createMessageTemplate);
router.patch('/:id', isAdmin, updateMessageTemplate);
router.delete('/:id', isAdmin, deleteMessageTemplate);

export default router;
