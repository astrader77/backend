import Expense from '../models/Expense.js';
import AuditLog from '../models/AuditLog.js';
import { getOrSyncCurrentSession } from '../utils/sessionHelper.js';
import { getCurrentBusinessDate } from '../utils/timeHelper.js';

// @desc    Get expenses
// @route   GET /api/expenses
export const getExpenses = async (req, res) => {
  try {
    const { businessDate, startDate, endDate, category } = req.query;
    const query = {};

    if (businessDate) {
      query.businessDate = businessDate;
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    const expenses = await Expense.find(query).sort({ date: -1 }).populate('createdBy', 'name');
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    return res.json({
      success: true,
      data: expenses,
      summary: {
        totalExpenses: expenses.length,
        totalAmount,
      },
    });
  } catch (error) {
    console.error('[getExpenses Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch expenses' });
  }
};

// @desc    Create expense
// @route   POST /api/expenses
export const createExpense = async (req, res) => {
  try {
    const { title, category, amount, notes } = req.body;

    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Title and a valid amount are required' });
    }

    const { session } = await getOrSyncCurrentSession();
    const businessDate = getCurrentBusinessDate();

    const expense = await Expense.create({
      title: title.trim(),
      category: category || 'Miscellaneous',
      amount: Number(amount),
      notes,
      businessSessionId: session ? session._id : null,
      businessDate,
      createdBy: req.user ? req.user._id : null,
    });

    await AuditLog.create({
      action: 'EXPENSE_RECORDED',
      entityType: 'Expense',
      entityId: expense._id,
      details: { title: expense.title, amount: expense.amount, category: expense.category },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'System',
    });

    return res.status(201).json({
      success: true,
      message: 'Expense recorded successfully',
      data: expense,
    });
  } catch (error) {
    console.error('[createExpense Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to record expense' });
  }
};

