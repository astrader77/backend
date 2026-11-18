import express from 'express';
import {
  getCurrentSession,
  openSession,
  closeSession,
  getSessionHistory,
  deleteSession,
} from '../controllers/sessionController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/current', getCurrentSession);
router.post('/open', protect, adminOnly, openSession);
router.post('/close', protect, adminOnly, closeSession);
router.get('/history', protect, getSessionHistory);
router.delete('/:id', protect, adminOnly, deleteSession);

export default router;

