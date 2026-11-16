import mongoose from 'mongoose';

const inventoryHistorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
    },
    movementType: {
      type: String,
      enum: [
        'OPENING',
        'PURCHASE',
        'SALE',
        'ADJUSTMENT_ADD',
        'ADJUSTMENT_SUB',
        'DAMAGE_LOSS',
      ],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    unitCost: {
      type: Number,
    },
    totalValue: {
      type: Number,
    },
    financialLoss: {
      type: Number,
      default: 0,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    reason: {
      type: String,
      trim: true,
    },
    businessSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessSession',
      index: true,
    },
    businessDate: {
      type: String,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export default mongoose.model('InventoryHistory', inventoryHistorySchema);

