import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function clearAllData() {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    // Connect WITHOUT specifying dbName so we get the default/admin connection
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    // List all databases
    const adminDb = mongoose.connection.db.admin();
    const dbList = await adminDb.listDatabases();
    console.log('📂 All databases found:');
    dbList.databases.forEach(db => console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024).toFixed(1)} KB)`));
    console.log();

    // Clear each non-system database
    const skipDbs = ['admin', 'local', 'config'];
    for (const dbInfo of dbList.databases) {
      if (skipDbs.includes(dbInfo.name)) continue;

      console.log(`\n🗄️  Clearing database: ${dbInfo.name}`);
      const db = mongoose.connection.client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();

      if (collections.length === 0) {
        console.log('   (empty)');
        continue;
      }

      for (const col of collections) {
        const result = await db.collection(col.name).deleteMany({});
        console.log(`   🗑️  ${col.name}: ${result.deletedCount} documents deleted`);
      }
    }

    console.log('\n🎉 All data cleared from MongoDB Atlas!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  }
}

clearAllData();
