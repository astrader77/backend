import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    category: {
      type: String,
      default: 'Urea Fertilizer',
      trim: true,
    },
    kgPerBag: {
      type: Number,
      default: 50, // Standard Urea Bag is 50 Kg
      min: 0.1,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    openingStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumStock: {
      type: Number,
      default: 10,
      min: 0,
    },
    unit: {
      type: String,
      enum: ['Bag', 'Kg'],
      default: 'Bag',
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
