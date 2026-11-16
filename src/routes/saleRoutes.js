import express from 'express';
import {
  createSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
} from '../controllers/saleController.js';
import { protect } from '../middleware/auth.js';
import { requireOpenSession } from '../middleware/businessHours.js';

const router = express.Router();

router.post('/', protect, requireOpenSession, createSale);
router.get('/', protect, getSales);
router.get('/:id', protect, getSaleById);
router.put('/:id', protect, updateSale);
router.delete('/:id', protect, deleteSale);

export default router;

