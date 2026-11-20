import { Router } from 'express';
import { login, currentUser, logout } from '../controllers/authController.js';

const router = Router();
router.post('/login', login);
router.get('/me', currentUser);
router.post('/logout', logout);
export default router;
