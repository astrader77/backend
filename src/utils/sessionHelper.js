import BusinessSession from '../models/BusinessSession.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Expense from '../models/Expense.js';
import InventoryHistory from '../models/InventoryHistory.js';
import Setting from '../models/Setting.js';
import { getNowPKT, getCurrentBusinessDate, isWithinBusinessHours, parseTimeToMinutes } from './timeHelper.js';

// Calculate current total stock across all products
export const calculateTotalCurrentStock = async () => {
  const products = await Product.find({ isActive: true });
  return products.reduce((acc, p) => acc + (p.currentStock || 0), 0);
};

// Compute totals for a session
export const computeSessionTotals = async (sessionId, businessDate) => {
  const [sales, purchases, expenses, historyLosses] = await Promise.all([
    Sale.find({ businessSessionId: sessionId, status: 'COMPLETED' }),
    Purchase.find({ businessSessionId: sessionId }),
    Expense.find({ businessSessionId: sessionId }),
    InventoryHistory.find({ businessSessionId: sessionId, financialLoss: { $gt: 0 } }),
  ]);

  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCostOfGoodsSold = sales.reduce((sum, s) => sum + (s.totalPurchaseCost || 0), 0);
  const totalProfit = sales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalQuantitySold = sales.reduce((sum, s) => sum + s.totalQuantity, 0);
  const totalQuantityPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Losses: stock damage/loss adjustments + if expenses exceed profit or specific loss
  const stockLossAmount = historyLosses.reduce((sum, h) => sum + (h.financialLoss || 0), 0);
  const expenseLoss = totalExpenses > totalProfit ? (totalExpenses - totalProfit) : 0;
  const totalLoss = stockLossAmount + expenseLoss;

  const closingStock = await calculateTotalCurrentStock();

  return {
    totalSales,
    totalPurchases,
    totalCostOfGoodsSold,
    totalProfit,
    totalLoss: stockLossAmount, // Explicit financial loss from stock damage/adjustment
    totalExpenses,
    totalTransactions: sales.length,
    totalQuantitySold,
    totalQuantityPurchased,
    closingStock,
  };
};

// Gets or synchronizes the current business session
export const getOrSyncCurrentSession = async () => {
  const now = getNowPKT();
  const currentDate = getCurrentBusinessDate();

  // Load configured store opening and closing times from Settings
  const settings = await Setting.findOne();
  const openingTimeStr = settings?.openingTime || '07:00 AM';
  const closingTimeStr = settings?.closingTime || '07:00 PM';
  const autoClosingEnabled = settings ? settings.autoClosingEnabled : true;

  const withinHours = autoClosingEnabled
    ? isWithinBusinessHours(openingTimeStr, closingTimeStr)
    : true;

  // 1. Close any older OPEN sessions from previous dates
  const olderOpenSessions = await BusinessSession.find({
    businessDate: { $lt: currentDate },
    status: 'OPEN',
  });

  for (const session of olderOpenSessions) {
    const totals = await computeSessionTotals(session._id, session.businessDate);
    session.closingTime = session.closingTime || now.toDate();
    session.closeReason = 'AUTO_SCHEDULED';
    session.status = 'CLOSED';
    Object.assign(session, totals);
    await session.save();
  }

  // 2. Find today's session
  let todaySession = await BusinessSession.findOne({ businessDate: currentDate });

  // If outside business hours and it's after closing
  const currentMinutes = now.hour() * 60 + now.minute();
  const configuredClosingMinutes = parseTimeToMinutes(closingTimeStr, 19 * 60);
  const isAfterClosing = autoClosingEnabled && currentMinutes >= configuredClosingMinutes;

  if (isAfterClosing && todaySession && todaySession.status === 'OPEN') {
    // Auto-close today's session
    const totals = await computeSessionTotals(todaySession._id, currentDate);
    todaySession.closingTime = now.toDate();
    todaySession.closeReason = 'AUTO_SCHEDULED';
    todaySession.status = 'CLOSED';
    Object.assign(todaySession, totals);
    await todaySession.save();
    return {
      session: todaySession,
      isOpen: false,
      reason: `Business hours ended (Closed at ${closingTimeStr} PKT). Change Store Closing Time in Settings to enter more sales.`,
    };
  }

  if (withinHours) {
    if (!todaySession) {
      // Find previous day's closing stock to carry forward
      const prevSession = await BusinessSession.findOne({ businessDate: { $lt: currentDate } }).sort({ businessDate: -1 });
      const currentStock = await calculateTotalCurrentStock();
      const openingStock = prevSession ? prevSession.closingStock || currentStock : currentStock;

      todaySession = await BusinessSession.create({
        businessDate: currentDate,
        openingTime: now.toDate(),
        scheduledOpeningTime: openingTimeStr,
        scheduledClosingTime: closingTimeStr,
        openingStock,
        closingStock: currentStock,
        status: 'OPEN',
      });
      return { session: todaySession, isOpen: true };
    }

    if (todaySession.status === 'CLOSED') {
      return { session: todaySession, isOpen: false, reason: 'Session manually or previously closed' };
    }

    return { session: todaySession, isOpen: true };
  } else {
    // Outside business hours
    return {
      session: todaySession || null,
      isOpen: false,
      reason: `Store is closed outside operating hours (${openingTimeStr} – ${closingTimeStr} PKT). Change timings in Settings to allow sales.`,
    };
  }
};

