import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema(
  {
    purchaseInvoice: {
      type: String,
      trim: true,
    },
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
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    supplier: {
      type: String,
      trim: true,
      default: 'Fertilizer Distributor',
    },
    notes: {
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
      type: String, // 'YYYY-MM-DD'
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
  },
  { timestamps: true }
);

export default mongoose.model('Purchase', purchaseSchema);

