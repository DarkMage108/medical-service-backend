import { Router } from 'express';
import {
  getSales,
  getSale,
  getPendingSales,
  createSale,
  updateSale,
  deleteSale,
  getKPIs,
  getLotPricing,
  getMonthlyReport,
} from '../controllers/sales.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// KPIs and reports
router.get('/kpis', getKPIs);
router.get('/lot-pricing', getLotPricing);
router.get('/monthly-report', getMonthlyReport);
router.get('/pending', getPendingSales);

// CRUD
router.get('/', getSales);
router.get('/:id', getSale);
router.post('/', createSale);
router.patch('/:id', updateSale);
router.delete('/:id', deleteSale);

export default router;
