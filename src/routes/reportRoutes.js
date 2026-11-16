import express from 'express';
import {
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getCustomReport,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/daily', protect, getDailyReport);
router.get('/weekly', protect, getWeeklyReport);
router.get('/monthly', protect, getMonthlyReport);
router.get('/custom', protect, getCustomReport);

export default router;

