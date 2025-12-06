import { Router } from 'express';
import { getUsers, getUser, updateUser, deleteUser } from '../controllers/user.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', isAdmin, getUsers);
router.get('/:id', getUser);
router.patch('/:id', isAdmin, updateUser);
router.delete('/:id', isAdmin, deleteUser);

export default router;
