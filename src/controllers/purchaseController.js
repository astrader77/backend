import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import InventoryHistory from '../models/InventoryHistory.js';
import AuditLog from '../models/AuditLog.js';
import { getOrSyncCurrentSession } from '../utils/sessionHelper.js';
import { getCurrentBusinessDate } from '../utils/timeHelper.js';

// @desc    Record new stock purchase entry
// @route   POST /api/purchases
export const createPurchase = async (req, res) => {
  try {
    const { productId, quantity, purchasePrice, supplier, notes, updateSellingPrice, newSellingPrice } = req.body;

    const numQty = Number(quantity);
    const numPrice = Number(purchasePrice);

    if (!productId || !numQty || numQty <= 0 || numPrice === undefined || numPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Product, valid quantity, and purchase price are required',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { session } = await getOrSyncCurrentSession();
    const businessDate = getCurrentBusinessDate();

    const previousStock = product.currentStock;
    const previousPurchasePrice = product.purchasePrice;

    // Weighted Average Inventory Cost Calculation
    const totalExistingValue = previousStock > 0 ? previousStock * previousPurchasePrice : 0;
    const totalNewValue = numQty * numPrice;
    const newStock = previousStock + numQty;
    const weightedAverageCost = (totalExistingValue + totalNewValue) / newStock;

    // Update product stock and weighted average purchase price
    product.currentStock = newStock;
    product.purchasePrice = Math.round(weightedAverageCost * 100) / 100;

    if (updateSellingPrice && newSellingPrice && Number(newSellingPrice) > 0) {
      product.sellingPrice = Number(newSellingPrice);
    }

    await product.save();

    const totalAmount = numQty * numPrice;

    // Create Purchase Record
    const purchase = await Purchase.create({
      purchaseInvoice: `PUR-${Date.now().toString().slice(-6)}`,
      productId: product._id,
      productName: product.productName,
      quantity: numQty,
      purchasePrice: numPrice,
      totalAmount,
      supplier: supplier || 'Fertilizer Distributor',
      notes,
      businessSessionId: session ? session._id : null,
      businessDate,
      createdBy: req.user ? req.user._id : null,
    });

    // Record Inventory Movement History
    await InventoryHistory.create({
      productId: product._id,
      productName: product.productName,
      movementType: 'PURCHASE',
      quantity: numQty,
      previousStock,
      newStock,
      unitCost: numPrice,
      totalValue: totalAmount,
      referenceId: purchase._id,
      reason: `Stock purchased from ${supplier || 'supplier'}`,
      businessSessionId: session ? session._id : null,
      businessDate,
      createdBy: req.user ? req.user._id : null,
    });

    await AuditLog.create({
      action: 'STOCK_PURCHASE',
      entityType: 'Purchase',
      entityId: purchase._id,
      details: {
        productName: product.productName,
        quantity: numQty,
        purchasePrice: numPrice,
        newStock,
        weightedAverageCost: product.purchasePrice,
      },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'System',
    });

    return res.status(201).json({
      success: true,
      message: `Purchase recorded: ${numQty} ${product.unit} added to ${product.productName}`,
      data: purchase,
    });
  } catch (error) {
    console.error('[createPurchase Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to record purchase' });
  }
};

// @desc    Get all purchases
// @route   GET /api/purchases
export const getPurchases = async (req, res) => {
  try {
    const { productId, startDate, endDate, limit = 100 } = req.query;
    const query = {};

    if (productId) query.productId = productId;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const purchases = await Purchase.find(query)
      .sort({ date: -1 })
      .limit(Number(limit))
      .populate('createdBy', 'name email');

    const totalSpent = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalBags = purchases.reduce((sum, p) => sum + p.quantity, 0);

    return res.json({
      success: true,
      data: purchases,
      summary: {
        totalPurchases: purchases.length,
        totalSpent,
        totalBags,
      },
    });
  } catch (error) {
    console.error('[getPurchases Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch purchases' });
  }
};

