import express from 'express';
import { getInventoryHistory } from '../controllers/inventoryHistoryController.js';

const router = express.Router();

// GET /api/inventory/history
router.get('/history', getInventoryHistory);

export default router;
