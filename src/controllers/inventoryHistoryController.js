import InventoryHistory from '../models/InventoryHistory.js';

// GET /api/inventory/history
export const getInventoryHistory = async (req, res) => {
  try {
    const { movementType, productId } = req.query;

    const filter = {};

    if (movementType && movementType !== 'all') {
      filter.movementType = movementType.toUpperCase();
    }

    if (productId && productId.trim() !== '') {
      filter.productId = productId;
    }

    const history = await InventoryHistory.find(filter)
      .sort({ date: -1 })
      .limit(500)
      .populate('productId', 'productName')
      .lean();

    res.json({ success: true, data: history });
  } catch (err) {
    console.error('[InventoryHistory] getInventoryHistory error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory history' });
  }
};
