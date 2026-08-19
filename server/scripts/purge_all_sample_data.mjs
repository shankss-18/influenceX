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

async function purgeAllSampleData() {
  console.log('====================================================');
  console.log('   INFLUENCEX COMPLETE SAMPLE DATA PURGE           ');
  console.log('====================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB:', MONGO_URI);

  const db = mongoose.connection.db;

  // 1. Delete all workshops/events
  const eventsRes = await db.collection('events').deleteMany({});
  console.log(`✅ Deleted ${eventsRes.deletedCount} workshops/events.`);

  // 2. Delete all event registrations
  const regRes = await db.collection('eventregistrations').deleteMany({});
  console.log(`✅ Deleted ${regRes.deletedCount} event registrations.`);

  // 3. Delete all attendance records
  const attRes = await db.collection('attendances').deleteMany({});
  console.log(`✅ Deleted ${attRes.deletedCount} attendance records.`);

  // 4. Delete all participation records
  const partRes = await db.collection('participationrecords').deleteMany({});
  console.log(`✅ Deleted ${partRes.deletedCount} participation records.`);

  // 5. Delete all credit transactions
  const txRes = await db.collection('credittransactions').deleteMany({});
  console.log(`✅ Deleted ${txRes.deletedCount} credit transactions.`);

  // 6. Delete all rank goodies
  const goodiesRes = await db.collection('rankgoodies').deleteMany({});
  console.log(`✅ Deleted ${goodiesRes.deletedCount} rank goodies.`);

  // 7. Delete all audit log entries
  const auditRes = await db.collection('auditlogs').deleteMany({});
  console.log(`✅ Deleted ${auditRes.deletedCount} audit log entries.`);

  // 8. Delete all temporary volunteer user accounts
  const volUserRes = await db.collection('users').deleteMany({ role: 'VOLUNTEER' });
  console.log(`✅ Deleted ${volUserRes.deletedCount} volunteer user accounts.`);

  // 9. Reset all student balances to 0 credits & Explorer level
  const studentResetRes = await db.collection('students').updateMany(
    {},
    {
      $set: {
        cachedTotalCredits: 0,
        currentLevel: 'Explorer',
        updatedAt: new Date(),
      },
    }
  );
  console.log(`✅ Reset credit balances to 0 for ${studentResetRes.modifiedCount} student records.`);

  // 10. Delete non-admin user accounts created for testing
  const studentUsersRes = await db.collection('users').deleteMany({ role: 'STUDENT' });
  console.log(`✅ Deleted ${studentUsersRes.deletedCount} student user auth accounts.`);

  console.log('\n====================================================');
  console.log('  🎉 ALL SAMPLE DATA PURGED FROM DATABASE!         ');
  console.log('     0 WORKSHOPS, 0 CREDITS, 0 TEMP ACCOUNTS REMAIN ');
  console.log('====================================================\n');

  await mongoose.disconnect();
  console.log('Database connection closed.');
}

purgeAllSampleData().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
