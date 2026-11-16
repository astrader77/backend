import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import InventoryHistory from '../models/InventoryHistory.js';
import AuditLog from '../models/AuditLog.js';
import { getOrSyncCurrentSession } from '../utils/sessionHelper.js';
import { getCurrentBusinessDate, getNowPKT } from '../utils/timeHelper.js';

// Helper to generate invoice number: INV-YYYYMMDD-XXXX
const generateInvoiceNumber = async (businessDate) => {
  const dateFormatted = businessDate.replace(/-/g, '');
  const countToday = await Sale.countDocuments({ businessDate });
  const sequence = String(countToday + 1).padStart(4, '0');
  return `INV-${dateFormatted}-${sequence}`;
};

// @desc    Complete a POS Sale
// @route   POST /api/sales
export const createSale = async (req, res) => {
  try {
    const { items, paymentMethod, customerName, customerPhone } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Sale must include at least one product item' });
    }

    // Verify Business Session is OPEN
    const { session, isOpen, reason } = await getOrSyncCurrentSession();
    if (!isOpen || !session) {
      return res.status(403).json({
        success: false,
        message: reason || 'Business session is CLOSED. Sales are only allowed between 07:00 AM and 07:00 PM PKT when session is OPEN.',
        isSessionClosed: true,
      });
    }

    const businessDate = session.businessDate;

    // Validate all items and stock availability first
    const preparedItems = [];
    let grandTotalAmount = 0;
    let grandTotalCost = 0;
    let grandTotalProfit = 0;
    let grandTotalQuantity = 0;

    for (const item of items) {
      const { productId, quantity, sellingPrice: customSellingPrice } = item;
      const numQty = Number(quantity);

      if (!productId || !numQty || numQty <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid product or quantity specified' });
      }

      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(404).json({ success: false, message: `Product not found or inactive: ${productId}` });
      }

      if (product.currentStock < numQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.productName}". Available: ${product.currentStock} ${product.unit}, Requested: ${numQty} ${product.unit}.`,
        });
      }

      const unitSellingPrice = customSellingPrice !== undefined && Number(customSellingPrice) >= 0
        ? Number(customSellingPrice)
        : product.sellingPrice;

      const unitPurchaseCost = product.purchasePrice;
      const subtotal = Math.round(unitSellingPrice * numQty * 100) / 100;
      const purchaseCost = Math.round(unitPurchaseCost * numQty * 100) / 100;
      const profit = Math.round((subtotal - purchaseCost) * 100) / 100;

      preparedItems.push({
        product,
        productId: product._id,
        productName: product.productName,
        quantity: numQty,
        purchaseCost: unitPurchaseCost,
        sellingPrice: unitSellingPrice,
        subtotal,
        profit,
        unit: product.unit,
      });

      grandTotalAmount += subtotal;
      grandTotalCost += purchaseCost;
      grandTotalProfit += profit;
      grandTotalQuantity += numQty;
    }

    grandTotalAmount = Math.round(grandTotalAmount * 100) / 100;
    grandTotalCost = Math.round(grandTotalCost * 100) / 100;
    grandTotalProfit = Math.round(grandTotalProfit * 100) / 100;

    // Deduct stock safely with atomic checks
    for (const item of preparedItems) {
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          currentStock: { $gte: item.quantity },
        },
        {
          $inc: { currentStock: -item.quantity },
        },
        { new: true }
      );

      if (!updated) {
        // Rollback any previously deducted items if race condition occurred
        return res.status(400).json({
          success: false,
          message: `Stock conflict: Could not deduct ${item.quantity} ${item.unit} for "${item.productName}". Stock may have changed. Please try again.`,
        });
      }

      item.newStock = updated.currentStock;
      item.previousStock = updated.currentStock + item.quantity;
    }

    const invoiceNumber = await generateInvoiceNumber(businessDate);

    // Create Sale record
    const sale = await Sale.create({
      invoiceNumber,
      products: preparedItems.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantity: p.quantity,
        purchaseCost: p.purchaseCost,
        sellingPrice: p.sellingPrice,
        subtotal: p.subtotal,
        profit: p.profit,
        unit: p.unit,
      })),
      totalQuantity: grandTotalQuantity,
      totalPurchaseCost: grandTotalCost,
      totalAmount: grandTotalAmount,
      totalProfit: grandTotalProfit,
      paymentMethod: paymentMethod || 'Cash',
      customerName: customerName ? customerName.trim() : 'Counter Sale',
      customerPhone: customerPhone ? customerPhone.trim() : '',
      businessSessionId: session._id,
      businessDate,
      date: new Date(),
      createdBy: req.user ? req.user._id : null,
      status: 'COMPLETED',
    });

    // Record Inventory History for each product
    for (const item of preparedItems) {
      await InventoryHistory.create({
        productId: item.productId,
        productName: item.productName,
        movementType: 'SALE',
        quantity: -item.quantity,
        previousStock: item.previousStock,
        newStock: item.newStock,
        unitCost: item.purchaseCost,
        totalValue: item.subtotal,
        referenceId: sale._id,
        reason: `Sold on invoice ${invoiceNumber} (${item.quantity} ${item.unit})`,
        businessSessionId: session._id,
        businessDate,
        createdBy: req.user ? req.user._id : null,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Sale completed successfully! Invoice #${invoiceNumber}`,
      data: sale,
    });
  } catch (error) {
    console.error('[createSale Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to complete sale' });
  }
};

// @desc    Get sales with pagination and filters
// @route   GET /api/sales
export const getSales = async (req, res) => {
  try {
    const { businessDate, startDate, endDate, paymentMethod, limit = 50, page = 1 } = req.query;
    const query = { status: 'COMPLETED' };

    if (businessDate) {
      query.businessDate = businessDate;
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [sales, totalCount] = await Promise.all([
      Sale.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email'),
      Sale.countDocuments(query),
    ]);

    const totalSalesAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalProfit = sales.reduce((sum, s) => sum + s.totalProfit, 0);
    const totalBags = sales.reduce((sum, s) => sum + s.totalQuantity, 0);

    return res.json({
      success: true,
      data: sales,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(totalCount / Number(limit)),
      },
      summary: {
        totalSalesAmount,
        totalProfit,
        totalBags,
      },
    });
  } catch (error) {
    console.error('[getSales Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales' });
  }
};

// @desc    Get single sale by ID
// @route   GET /api/sales/:id
export const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('createdBy', 'name email');
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale record not found' });
    }
    return res.json({ success: true, data: sale });
  } catch (error) {
    console.error('[getSaleById Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sale details' });
  }
};

// @desc    Update a sale (customer info, payment method)
// @route   PUT /api/sales/:id
export const updateSale = async (req, res) => {
  try {
    const { customerName, customerPhone, paymentMethod } = req.body;
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale record not found' });
    }

    if (customerName !== undefined) sale.customerName = customerName.trim() || 'Counter Sale';
    if (customerPhone !== undefined) sale.customerPhone = customerPhone.trim();
    if (paymentMethod !== undefined) sale.paymentMethod = paymentMethod;

    await sale.save();

    return res.json({
      success: true,
      message: 'Order updated successfully',
      data: sale,
    });
  } catch (error) {
    console.error('[updateSale Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to update order' });
  }
};

// @desc    Delete/Void a sale and RESTORE stock back to products
// @route   DELETE /api/sales/:id
export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale record not found' });
    }

    // Restore stock for all products in this sale
    for (const item of sale.products) {
      const prod = await Product.findById(item.productId);
      if (prod) {
        const prevStock = prod.currentStock;
        prod.currentStock += item.quantity;
        await prod.save();

        // Record stock restore in InventoryHistory
        await InventoryHistory.create({
          productId: prod._id,
          productName: prod.productName,
          movementType: 'ADJUSTMENT_ADD',
          quantity: item.quantity,
          previousStock: prevStock,
          newStock: prod.currentStock,
          unitCost: item.purchaseCost,
          totalValue: item.subtotal,
          referenceId: sale._id,
          reason: `Order #${sale.invoiceNumber} deleted - Stock Restored (+${item.quantity} ${item.unit})`,
          businessSessionId: sale.businessSessionId,
          businessDate: sale.businessDate,
          createdBy: req.user ? req.user._id : null,
        });
      }
    }

    // Delete the sale record
    await Sale.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: `Order #${sale.invoiceNumber} deleted successfully and inventory stock restored!`,
    });
  } catch (error) {
    console.error('[deleteSale Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete order' });
  }
};


