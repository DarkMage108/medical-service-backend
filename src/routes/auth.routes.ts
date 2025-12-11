import { Router } from 'express';
import { login, register, getMe, changePassword, updateProfile } from '../controllers/auth.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/register', authenticate, isAdmin, register);
router.get('/me', authenticate, getMe);
router.patch('/change-password', authenticate, changePassword);
router.patch('/profile', authenticate, updateProfile);

export default router;
