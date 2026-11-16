import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import InventoryHistory from '../models/InventoryHistory.js';
import Expense from '../models/Expense.js';
import { getOrSyncCurrentSession, computeSessionTotals } from '../utils/sessionHelper.js';
import { getCurrentBusinessDate, getNowPKT, dayjs } from '../utils/timeHelper.js';

// @desc    Get dashboard summary cards
// @route   GET /api/dashboard/summary
export const getDashboardSummary = async (req, res) => {
  try {
    const { session } = await getOrSyncCurrentSession();
    const currentDate = getCurrentBusinessDate();

    // Fetch today's sales, purchases, and losses
    const [todaySales, todayPurchases, todayLosses, allProducts, todayExpenses] = await Promise.all([
      Sale.find({ businessDate: currentDate, status: 'COMPLETED' }),
      Purchase.find({ businessDate: currentDate }),
      InventoryHistory.find({ businessDate: currentDate, financialLoss: { $gt: 0 } }),
      Product.find({ isActive: true }),
      Expense.find({ businessDate: currentDate }),
    ]);

    const totalSales = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPurchases = todayPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalCostOfGoodsSold = todaySales.reduce((sum, s) => sum + (s.totalPurchaseCost || 0), 0);
    const grossProfit = todaySales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
    const totalExpenses = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Explicit stock damage losses
    const stockDamageLoss = todayLosses.reduce((sum, l) => sum + (l.financialLoss || 0), 0);
    const expenseLoss = totalExpenses > grossProfit ? totalExpenses - grossProfit : 0;
    const totalLoss = stockDamageLoss + expenseLoss;
    const netProfit = Math.max(0, grossProfit - totalExpenses);

    const availableStock = allProducts.reduce((sum, p) => sum + p.currentStock, 0);
    const lowStockCount = allProducts.filter((p) => p.currentStock <= p.minimumStock).length;
    const totalTransactions = todaySales.length;

    return res.json({
      success: true,
      data: {
        todaySales,
        cards: {
          todaySales: totalSales,
          todayPurchases,
          todayProfit: grossProfit,
          todayLoss: totalLoss,
          todayExpenses,
          netProfit,
          availableStock,
          totalTransactions,
          lowStockCount,
        },
        sessionInfo: {
          businessDate: currentDate,
          status: session ? session.status : 'CLOSED',
          openingStock: session ? session.openingStock : availableStock,
        },
      },
    });
  } catch (error) {
    console.error('[getDashboardSummary Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard summary' });
  }
};

// @desc    Get dashboard charts and lists
// @route   GET /api/dashboard/charts
export const getDashboardCharts = async (req, res) => {
  try {
    const currentDate = getCurrentBusinessDate();
    const now = getNowPKT();

    // 1. Weekly Sales Chart (Past 7 days)
    const past7Days = [];
    for (let i = 6; i >= 0; i--) {
      past7Days.push(now.subtract(i, 'day').format('YYYY-MM-DD'));
    }

    const weeklySalesData = await Promise.all(
      past7Days.map(async (dateStr) => {
        const daySales = await Sale.find({ businessDate: dateStr, status: 'COMPLETED' });
        const salesAmount = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
        const profitAmount = daySales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
        const totalBags = daySales.reduce((sum, s) => sum + s.totalQuantity, 0);

        return {
          date: dateStr,
          dayName: dayjs(dateStr).format('ddd'),
          sales: salesAmount,
          profit: profitAmount,
          bags: totalBags,
        };
      })
    );

    // 2. Monthly Sales Chart (Past 4 Weeks / 30 Days)
    const past30Days = [];
    for (let i = 29; i >= 0; i--) {
      past30Days.push(now.subtract(i, 'day').format('YYYY-MM-DD'));
    }

    const monthlySalesData = await Promise.all(
      past30Days.map(async (dateStr) => {
        const daySales = await Sale.find({ businessDate: dateStr, status: 'COMPLETED' });
        const salesAmount = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
        const profitAmount = daySales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);

        return {
          date: dateStr,
          formattedDate: dayjs(dateStr).format('DD MMM'),
          sales: salesAmount,
          profit: profitAmount,
        };
      })
    );

    // 3. Recent 10 Transactions
    const recentSales = await Sale.find({ status: 'COMPLETED' })
      .sort({ date: -1 })
      .limit(10)
      .populate('createdBy', 'name');

    // 4. Current Inventory Status & Low Stock Alerts
    const products = await Product.find({ isActive: true }).sort({ currentStock: 1 });
    const lowStockAlerts = products.filter((p) => p.currentStock <= p.minimumStock);

    return res.json({
      success: true,
      data: {
        weeklySales: weeklySalesData,
        monthlySales: monthlySalesData,
        recentSales,
        inventoryStatus: products,
        lowStockAlerts,
      },
    });
  } catch (error) {
    console.error('[getDashboardCharts Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard charts' });
  }
};

