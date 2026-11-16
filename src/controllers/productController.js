import Product from '../models/Product.js';
import InventoryHistory from '../models/InventoryHistory.js';
import AuditLog from '../models/AuditLog.js';
import { getOrSyncCurrentSession } from '../utils/sessionHelper.js';
import { getCurrentBusinessDate } from '../utils/timeHelper.js';

// @desc    Get all products
// @route   GET /api/products
export const getProducts = async (req, res) => {
  try {
    const { search, category, lowStockOnly } = req.query;
    const query = { isActive: true };

    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (lowStockOnly === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }

    const products = await Product.find(query).sort({ productName: 1 });

    const totalStock = products.reduce((sum, p) => sum + p.currentStock, 0);
    const totalWeightKg = products.reduce(
      (sum, p) => sum + p.currentStock * (p.kgPerBag || 50),
      0
    );
    const lowStockCount = products.filter((p) => p.currentStock <= p.minimumStock).length;
    const totalInventoryValue = products.reduce(
      (sum, p) => sum + p.currentStock * p.purchasePrice,
      0
    );

    return res.json({
      success: true,
      data: products,
      summary: {
        totalProducts: products.length,
        totalStock,
        totalWeightKg,
        lowStockCount,
        totalInventoryValue,
      },
    });
  } catch (error) {
    console.error('[getProducts Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    console.error('[getProductById Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
};

// @desc    Create new product
// @route   POST /api/products
export const createProduct = async (req, res) => {
  try {
    const {
      productName,
      category,
      kgPerBag,
      purchasePrice,
      sellingPrice,
      openingStock,
      minimumStock,
      unit,
      description,
    } = req.body;

    if (!productName || purchasePrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Product name, purchase price, and selling price are required',
      });
    }

    const existingProduct = await Product.findOne({
      productName: { $regex: new RegExp(`^${productName.trim()}$`, 'i') },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'A product with this name already exists',
      });
    }

    const initialStock = Number(openingStock) || 0;
    const product = await Product.create({
      productName: productName.trim(),
      category: category || 'Urea Fertilizer',
      kgPerBag: kgPerBag !== undefined ? Number(kgPerBag) : 50,
      purchasePrice: Number(purchasePrice),
      sellingPrice: Number(sellingPrice),
      openingStock: initialStock,
      currentStock: initialStock,
      minimumStock: minimumStock !== undefined ? Number(minimumStock) : 10,
      unit: unit || 'Bag',
      description,
    });

    const { session } = await getOrSyncCurrentSession();
    const businessDate = getCurrentBusinessDate();

    // Log opening stock in inventory history if initialStock > 0
    if (initialStock > 0) {
      await InventoryHistory.create({
        productId: product._id,
        productName: product.productName,
        movementType: 'OPENING',
        quantity: initialStock,
        previousStock: 0,
        newStock: initialStock,
        unitCost: product.purchasePrice,
        totalValue: initialStock * product.purchasePrice,
        reason: 'Initial opening stock creation',
        businessSessionId: session ? session._id : null,
        businessDate,
        createdBy: req.user ? req.user._id : null,
      });
    }

    await AuditLog.create({
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product._id,
      details: { productName: product.productName, initialStock },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'System',
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    console.error('[createProduct Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create product' });
  }
};

// @desc    Update product details
// @route   PUT /api/products/:id
export const updateProduct = async (req, res) => {
  try {
    const {
      productName,
      category,
      kgPerBag,
      purchasePrice,
      sellingPrice,
      minimumStock,
      unit,
      description,
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (productName && productName.trim().toLowerCase() !== product.productName.toLowerCase()) {
      const existing = await Product.findOne({
        _id: { $ne: product._id },
        productName: { $regex: new RegExp(`^${productName.trim()}$`, 'i') },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Another product with this name already exists' });
      }
      product.productName = productName.trim();
    }

    if (category) product.category = category;
    if (kgPerBag !== undefined) product.kgPerBag = Number(kgPerBag);
    if (purchasePrice !== undefined) product.purchasePrice = Number(purchasePrice);
    if (sellingPrice !== undefined) product.sellingPrice = Number(sellingPrice);
    if (minimumStock !== undefined) product.minimumStock = Number(minimumStock);
    if (unit) product.unit = unit;
    if (description !== undefined) product.description = description;

    await product.save();

    await AuditLog.create({
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: product._id,
      details: { changes: req.body },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'System',
    });

    return res.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('[updateProduct Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

// @desc    Stock adjustment (Add / Subtract / Damage loss)
// @route   POST /api/products/:id/adjust-stock
export const adjustStock = async (req, res) => {
  try {
    const { adjustmentType, quantity, reason, isDamageLoss } = req.body;
    const numQty = Number(quantity);

    if (!numQty || numQty <= 0) {
      return res.status(400).json({ success: false, message: 'Valid quantity is required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const previousStock = product.currentStock;
    let newStock = previousStock;
    let movementType = 'ADJUSTMENT_ADD';
    let financialLoss = 0;

    if (adjustmentType === 'SUBTRACT' || isDamageLoss) {
      if (previousStock < numQty) {
        return res.status(400).json({
          success: false,
          message: `Cannot deduct ${numQty} ${product.unit}. Current stock is only ${previousStock} ${product.unit}.`,
        });
      }
      newStock = previousStock - numQty;
      movementType = isDamageLoss ? 'DAMAGE_LOSS' : 'ADJUSTMENT_SUB';
      if (isDamageLoss) {
        // Financial loss = qty * purchase cost
        financialLoss = numQty * product.purchasePrice;
      }
    } else {
      newStock = previousStock + numQty;
      movementType = 'ADJUSTMENT_ADD';
    }

    product.currentStock = newStock;
    await product.save();

    const { session } = await getOrSyncCurrentSession();
    const businessDate = getCurrentBusinessDate();

    const historyRecord = await InventoryHistory.create({
      productId: product._id,
      productName: product.productName,
      movementType,
      quantity: numQty,
      previousStock,
      newStock,
      unitCost: product.purchasePrice,
      totalValue: numQty * product.purchasePrice,
      financialLoss,
      reason: reason || (isDamageLoss ? 'Damaged / Spoiled fertilizer' : 'Manual stock count adjustment'),
      businessSessionId: session ? session._id : null,
      businessDate,
      createdBy: req.user ? req.user._id : null,
    });

    await AuditLog.create({
      action: 'STOCK_ADJUSTMENT',
      entityType: 'Product',
      entityId: product._id,
      details: { movementType, quantity: numQty, previousStock, newStock, financialLoss, reason },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'System',
    });

    return res.json({
      success: true,
      message: `Stock adjusted successfully. New stock: ${newStock} ${product.unit}`,
      data: {
        product,
        historyRecord,
      },
    });
  } catch (error) {
    console.error('[adjustStock Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to adjust stock' });
  }
};

// @desc    Delete a product (or soft-delete if it has sales history)
// @route   DELETE /api/products/:id
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Permanently remove product from inventory database
    await Product.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'PRODUCT_DELETED',
      entityType: 'Product',
      entityId: product._id,
      details: { productName: product.productName, stockAtDeletion: product.currentStock },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'Admin',
    });

    return res.json({
      success: true,
      message: `Product "${product.productName}" has been deleted successfully`,
    });
  } catch (error) {
    console.error('[deleteProduct Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete product' });
  }
};

// @desc    Get inventory movement history
// @route   GET /api/inventory/history
export const getInventoryHistory = async (req, res) => {
  try {
    const { productId, movementType, startDate, endDate, limit = 100 } = req.query;
    const query = {};

    if (productId) query.productId = productId;
    if (movementType && movementType !== 'all') query.movementType = movementType;

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const history = await InventoryHistory.find(query)
      .sort({ date: -1 })
      .limit(Number(limit))
      .populate('createdBy', 'name email');

    return res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error('[getInventoryHistory Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory history' });
  }
};

