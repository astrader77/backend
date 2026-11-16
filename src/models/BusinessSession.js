import mongoose from 'mongoose';

const businessSessionSchema = new mongoose.Schema(
  {
    businessDate: {
      type: String, // 'YYYY-MM-DD' in Asia/Karachi timezone
      required: true,
      unique: true,
      index: true,
    },
    openingTime: {
      type: Date,
      required: true,
    },
    closingTime: {
      type: Date,
    },
    scheduledOpeningTime: {
      type: String,
      default: '07:00 AM',
    },
    scheduledClosingTime: {
      type: String,
      default: '07:00 PM',
    },
    openingStock: {
      type: Number,
      default: 0,
    },
    closingStock: {
      type: Number,
      default: 0,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
    totalPurchases: {
      type: Number,
      default: 0,
    },
    totalCostOfGoodsSold: {
      type: Number,
      default: 0,
    },
    totalProfit: {
      type: Number,
      default: 0,
    },
    totalLoss: {
      type: Number,
      default: 0,
    },
    totalExpenses: {
      type: Number,
      default: 0,
    },
    totalTransactions: {
      type: Number,
      default: 0,
    },
    totalQuantitySold: {
      type: Number,
      default: 0,
    },
    totalQuantityPurchased: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    closeReason: {
      type: String,
      enum: ['AUTO_SCHEDULED', 'MANUAL_CLOSING'],
    },
    manualCloseNotes: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('BusinessSession', businessSessionSchema);

