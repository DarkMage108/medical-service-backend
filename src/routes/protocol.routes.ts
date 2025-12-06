import { Router } from 'express';
import {
  getProtocols,
  getProtocol,
  createProtocol,
  updateProtocol,
  deleteProtocol,
} from '../controllers/protocol.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getProtocols);
router.get('/:id', getProtocol);
router.post('/', isAdmin, createProtocol);
router.patch('/:id', isAdmin, updateProtocol);
router.delete('/:id', isAdmin, deleteProtocol);

export default router;
