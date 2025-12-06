import { Router } from 'express';
import {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getAvailableLots,
} from '../controllers/inventory.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getInventory);
router.get('/available', getAvailableLots);
router.get('/:id', getInventoryItem);
router.post('/', createInventoryItem);
router.patch('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);

export default router;
