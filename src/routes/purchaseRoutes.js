import express from 'express';
import { createPurchase, getPurchases } from '../controllers/purchaseController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, adminOnly, createPurchase);
router.get('/', protect, getPurchases);

export default router;

