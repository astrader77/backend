import express from 'express';
import { getExpenses, createExpense } from '../controllers/expenseController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getExpenses);
router.post('/', protect, adminOnly, createExpense);

export default router;

