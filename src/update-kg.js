import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from './models/Product.js';

dotenv.config();

const updateProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const products = await Product.find();
    for (const p of products) {
      if (!p.kgPerBag || p.kgPerBag === 0) {
        if (p.unit === 'Kg') {
          p.kgPerBag = 1;
        } else {
          p.kgPerBag = 50; // Standard fertilizer bag = 50 Kg
        }
        await p.save();
        console.log(`Updated ${p.productName}: kgPerBag = ${p.kgPerBag}`);
      }
    }
    console.log('All products updated with kgPerBag!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

updateProducts();

