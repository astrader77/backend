import express from 'express';
import { loginUser, getMe, updatePassword, registerUser } from '../controllers/authController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);
router.post('/register', protect, adminOnly, registerUser);

export default router;

