import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/influencex_dev';

async function purgeStudentsCollection() {
  console.log('====================================================');
  console.log('   INFLUENCEX SAMPLE STUDENTS PURGE                ');
  console.log('====================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB:', MONGO_URI);

  const db = mongoose.connection.db;

  // Purge all student documents
  const studentsRes = await db.collection('students').deleteMany({});
  console.log(`✅ Deleted all ${studentsRes.deletedCount} sample student records from database.`);

  // Purge all non-admin users (students & volunteers)
  const nonAdminUsersRes = await db.collection('users').deleteMany({
    role: { $in: ['STUDENT', 'VOLUNTEER'] },
  });
  console.log(`✅ Deleted ${nonAdminUsersRes.deletedCount} non-admin user auth accounts.`);

  console.log('\n====================================================');
  console.log('  🎉 ALL SAMPLE STUDENTS COMPLETELY REMOVED!       ');
  console.log('====================================================\n');

  await mongoose.disconnect();
  console.log('Database connection closed.');
}

purgeStudentsCollection().catch((err) => {
  console.error('Students purge failed:', err);
  process.exit(1);
});
