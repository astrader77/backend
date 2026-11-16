import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      default: 'AS Traders Fertilizer & Agro Chemicals',
    },
    shopPhone: {
      type: String,
      default: '+92 300 1234567',
    },
    shopAddress: {
      type: String,
      default: 'Grain Market, Punjab, Pakistan',
    },
    openingTime: {
      type: String,
      default: '07:00 AM',
    },
    closingTime: {
      type: String,
      default: '07:00 PM',
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi',
    },
    currency: {
      type: String,
      default: 'PKR',
    },
    autoClosingEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);

