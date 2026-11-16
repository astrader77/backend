import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import Expense from '../models/Expense.js';
import InventoryHistory from '../models/InventoryHistory.js';
import { getCurrentBusinessDate, getNowPKT, dayjs } from '../utils/timeHelper.js';
import { calculateTotalCurrentStock } from '../utils/sessionHelper.js';

// Helper to calculate analytics for a date range
const generateReportData = async (startDate, endDate, label = 'Report') => {
  const [sales, purchases, expenses, historyRecords, products] = await Promise.all([
    Sale.find({
      businessDate: { $gte: startDate, $lte: endDate },
      status: 'COMPLETED',
    }).sort({ date: 1 }),
    Purchase.find({
      businessDate: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 }),
    Expense.find({
      businessDate: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 }),
    InventoryHistory.find({
      businessDate: { $gte: startDate, $lte: endDate },
    }).sort({ date: -1 }),
    Product.find({ isActive: true }),
  ]);

  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCostOfGoodsSold = sales.reduce((sum, s) => sum + (s.totalPurchaseCost || 0), 0);
  const totalGrossProfit = sales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalQuantitySold = sales.reduce((sum, s) => sum + s.totalQuantity, 0);
  const totalQuantityPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0);

  // Financial stock damage losses
  const stockLossRecords = historyRecords.filter((h) => (h.financialLoss || 0) > 0);
  const totalStockLoss = stockLossRecords.reduce((sum, h) => sum + h.financialLoss, 0);

  const expenseLoss = totalExpenses > totalGrossProfit ? (totalExpenses - totalGrossProfit) : 0;
  const totalLoss = totalStockLoss + expenseLoss;
  const netProfit = Math.max(0, totalGrossProfit - totalExpenses - totalStockLoss);

  const remainingStock = products.reduce((sum, p) => sum + p.currentStock, 0);
  const remainingStockValue = products.reduce((sum, p) => sum + p.currentStock * p.purchasePrice, 0);

  // Daily breakdowns for charts
  const dailyMap = {};
  sales.forEach((s) => {
    if (!dailyMap[s.businessDate]) {
      dailyMap[s.businessDate] = { date: s.businessDate, sales: 0, profit: 0, purchases: 0, bags: 0 };
    }
    dailyMap[s.businessDate].sales += s.totalAmount;
    dailyMap[s.businessDate].profit += s.totalProfit || 0;
    dailyMap[s.businessDate].bags += s.totalQuantity;
  });

  purchases.forEach((p) => {
    if (!dailyMap[p.businessDate]) {
      dailyMap[p.businessDate] = { date: p.businessDate, sales: 0, profit: 0, purchases: 0, bags: 0 };
    }
    dailyMap[p.businessDate].purchases += p.totalAmount;
  });

  const chartData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // Product sales breakdown
  const productPerformance = {};
  sales.forEach((s) => {
    s.products.forEach((p) => {
      if (!productPerformance[p.productName]) {
        productPerformance[p.productName] = {
          name: p.productName,
          quantity: 0,
          totalSales: 0,
          totalProfit: 0,
        };
      }
      productPerformance[p.productName].quantity += p.quantity;
      productPerformance[p.productName].totalSales += p.subtotal;
      productPerformance[p.productName].totalProfit += p.profit;
    });
  });

  return {
    meta: {
      label,
      startDate,
      endDate,
    },
    summary: {
      totalSales,
      totalPurchases,
      totalCostOfGoodsSold,
      grossProfit: totalGrossProfit,
      totalExpenses,
      totalLoss,
      stockLoss: totalStockLoss,
      netProfit,
      totalTransactions: sales.length,
      totalQuantitySold,
      totalQuantityPurchased,
      remainingStock,
      remainingStockValue,
    },
    chartData,
    productPerformance: Object.values(productPerformance),
    recentSales: sales.slice(-20).reverse(),
    stockMovements: historyRecords.slice(0, 30),
  };
};

// @desc    Daily Report
// @route   GET /api/reports/daily
export const getDailyReport = async (req, res) => {
  try {
    const targetDate = req.query.date || getCurrentBusinessDate();
    const data = await generateReportData(targetDate, targetDate, `Daily Report (${targetDate})`);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[getDailyReport Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate daily report' });
  }
};

// @desc    Weekly Report
// @route   GET /api/reports/weekly
export const getWeeklyReport = async (req, res) => {
  try {
    const end = req.query.endDate || getCurrentBusinessDate();
    const start = req.query.startDate || dayjs(end).subtract(6, 'day').format('YYYY-MM-DD');
    const data = await generateReportData(start, end, `Weekly Report (${start} to ${end})`);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[getWeeklyReport Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate weekly report' });
  }
};

// @desc    Monthly Report
// @route   GET /api/reports/monthly
export const getMonthlyReport = async (req, res) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM'); // e.g. '2026-11'
    const start = `${month}-01`;
    const end = dayjs(start).endOf('month').format('YYYY-MM-DD');
    const data = await generateReportData(start, end, `Monthly Report (${dayjs(start).format('MMMM YYYY')})`);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[getMonthlyReport Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate monthly report' });
  }
};

// @desc    Custom Date Range Report
// @route   GET /api/reports/custom
export const getCustomReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and End date are required' });
    }
    const data = await generateReportData(startDate, endDate, `Custom Report (${startDate} to ${endDate})`);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[getCustomReport Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate custom report' });
  }
};

