import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Product from './models/Product.js';
import Setting from './models/Setting.js';
import InventoryHistory from './models/InventoryHistory.js';
import BusinessSession from './models/BusinessSession.js';
import { getCurrentBusinessDate, getNowPKT } from './utils/timeHelper.js';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Seed] Connected to MongoDB Atlas');

    // 1. Seed Admin User
    let admin = await User.findOne({ email: 'admin@astrader.com' });
    if (!admin) {
      admin = await User.create({
        name: 'Admin Manager',
        email: 'admin@astrader.com',
        password: 'admin123@password',
        role: 'admin',
      });
      console.log('[Seed] Admin user created: admin@astrader.com / admin123@password');
    } else {
      console.log('[Seed] Admin user already exists');
    }

    // 2. Seed Default Settings
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        shopName: 'AS Traders Fertilizer & Agro Chemicals',
        shopPhone: '+92 300 7654321',
        shopAddress: 'Shop # 14-B, Grain Market, Multan Road, Punjab, Pakistan',
        openingTime: '07:00 AM',
        closingTime: '07:00 PM',
        timezone: 'Asia/Karachi',
        currency: 'PKR',
        autoClosingEnabled: true,
      });
      console.log('[Seed] Default settings created');
    }

    // 3. Seed Default Fertilizer Products if none exist
    const productCount = await Product.countDocuments();
    const businessDate = getCurrentBusinessDate();
    const now = getNowPKT();

    if (productCount === 0) {
      const defaultProducts = [
        {
          productName: 'Sona Urea (FFC) 50kg',
          category: 'Urea Fertilizer',
          purchasePrice: 4320,
          sellingPrice: 4580,
          openingStock: 250,
          currentStock: 250,
          minimumStock: 40,
          unit: 'Bag',
          description: 'Fauji Fertilizer Company Sona Prilled Urea 50kg bag, 46% Nitrogen',
        },
        {
          productName: 'Engro Urea 50kg',
          category: 'Urea Fertilizer',
          purchasePrice: 4300,
          sellingPrice: 4550,
          openingStock: 200,
          currentStock: 200,
          minimumStock: 30,
          unit: 'Bag',
          description: 'Engro Fertilizers Limited Granular Urea 50kg bag, 46% Nitrogen',
        },
        {
          productName: 'Tara Urea (Fatima) 50kg',
          category: 'Urea Fertilizer',
          purchasePrice: 4280,
          sellingPrice: 4520,
          openingStock: 180,
          currentStock: 180,
          minimumStock: 25,
          unit: 'Bag',
          description: 'Fatima Fertilizer Tara brand high-purity urea 50kg bag',
        },
        {
          productName: 'Sarsabz Urea 50kg',
          category: 'Urea Fertilizer',
          purchasePrice: 4290,
          sellingPrice: 4540,
          openingStock: 150,
          currentStock: 150,
          minimumStock: 25,
          unit: 'Bag',
          description: 'Fatima Group Sarsabz Urea 50kg bag for agricultural fertilization',
        },
        {
          productName: 'Granular Coated Urea (Loose Kg)',
          category: 'Urea Fertilizer',
          purchasePrice: 88,
          sellingPrice: 96,
          openingStock: 1200,
          currentStock: 1200,
          minimumStock: 200,
          unit: 'Kg',
          description: 'High efficiency slow-release coated granular urea sold per Kilogram',
        },
      ];

      for (const p of defaultProducts) {
        const createdProduct = await Product.create(p);
        await InventoryHistory.create({
          productId: createdProduct._id,
          productName: createdProduct.productName,
          movementType: 'OPENING',
          quantity: createdProduct.openingStock,
          previousStock: 0,
          newStock: createdProduct.openingStock,
          unitCost: createdProduct.purchasePrice,
          totalValue: createdProduct.openingStock * createdProduct.purchasePrice,
          reason: 'Initial business inventory setup',
          businessDate,
          createdBy: admin._id,
        });
      }
      console.log(`[Seed] Created ${defaultProducts.length} default fertilizer products with inventory history`);
    } else {
      console.log(`[Seed] Products already exist (${productCount} found)`);
    }

    // 4. Check or Create Business Session for today
    let session = await BusinessSession.findOne({ businessDate });
    if (!session) {
      const allProds = await Product.find({ isActive: true });
      const totalStock = allProds.reduce((sum, p) => sum + p.currentStock, 0);

      session = await BusinessSession.create({
        businessDate,
        openingTime: now.toDate(),
        scheduledOpeningTime: '07:00 AM',
        scheduledClosingTime: '07:00 PM',
        openingStock: totalStock,
        closingStock: totalStock,
        status: 'OPEN',
      });
      console.log(`[Seed] Business session created for ${businessDate} with status OPEN`);
    } else {
      console.log(`[Seed] Business session for ${businessDate} already exists (status: ${session.status})`);
    }

    console.log('[Seed] Database seeding completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
};

seedData();

