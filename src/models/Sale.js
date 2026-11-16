import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.01,
  },
  purchaseCost: {
    type: Number, // Cost per unit at time of sale
    required: true,
    min: 0,
  },
  sellingPrice: {
    type: Number, // Selling price per unit
    required: true,
    min: 0,
  },
  subtotal: {
    type: Number,
    required: true,
  },
  profit: {
    type: Number, // (sellingPrice - purchaseCost) * quantity
    required: true,
  },
  unit: {
    type: String,
    default: 'Bag',
  },
});

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    products: [saleItemSchema],
    totalQuantity: {
      type: Number,
      required: true,
    },
    totalPurchaseCost: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalProfit: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank', 'Other'],
      default: 'Cash',
    },
    customerName: {
      type: String,
      trim: true,
      default: 'Counter Sale',
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    businessSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessSession',
      required: true,
      index: true,
    },
    businessDate: {
      type: String, // 'YYYY-MM-DD' in PKT
      required: true,
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
    status: {
      type: String,
      enum: ['COMPLETED', 'VOIDED'],
      default: 'COMPLETED',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Sale', saleSchema);

