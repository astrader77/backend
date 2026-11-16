import express from 'express';
import { getDashboardSummary, getDashboardCharts } from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/summary', protect, getDashboardSummary);
router.get('/charts', protect, getDashboardCharts);

export default router;

