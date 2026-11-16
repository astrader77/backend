import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Transport', 'Electricity / Utilities', 'Labor / Loading', 'Rent', 'Tea & Refreshment', 'Miscellaneous'],
      default: 'Miscellaneous',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
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

export default mongoose.model('Expense', expenseSchema);

