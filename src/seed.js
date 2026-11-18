import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// ── Inline User Schema (avoid circular import issues) ──
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  role:      { type: String, enum: ['admin', 'user'], default: 'admin' },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function seed() {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    // Check if admin already exists
    const existing = await User.findOne({ email: 'admin@astrader.com' });
    if (existing) {
      console.log('ℹ️  Admin user already exists — skipping creation.');
    } else {
      const hashed = await bcrypt.hash('admin123@password', 12);
      await User.create({
        name: 'Admin',
        email: 'admin@astrader.com',
        password: hashed,
        role: 'admin',
      });
      console.log('✅ Admin user created successfully!');
      console.log('   Email:    admin@astrader.com');
      console.log('   Password: admin123@password');
    }

    console.log('\n🎉 Seed complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  }
}

seed();
