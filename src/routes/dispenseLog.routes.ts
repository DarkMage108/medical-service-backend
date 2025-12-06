import { Router } from 'express';
import { getDispenseLogs, getDispenseReport } from '../controllers/dispenseLog.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getDispenseLogs);
router.get('/report', getDispenseReport);

export default router;
