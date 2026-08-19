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

async function purgeAndResetDatabase() {
  console.log('====================================================');
  console.log('   INFLUENCEX DATABASE PURGE & ZERO CREDIT RESET    ');
  console.log('====================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB:', MONGO_URI);

  const db = mongoose.connection.db;

  // 1. Purge all test workshops / events
  const eventsResult = await db.collection('events').deleteMany({});
  console.log(`✅ Deleted ${eventsResult.deletedCount} workshops/events.`);

  // 2. Purge registrations, attendance, participation, transactions & goodies
  const regResult = await db.collection('eventregistrations').deleteMany({});
  console.log(`✅ Deleted ${regResult.deletedCount} event registrations.`);

  const attResult = await db.collection('attendances').deleteMany({});
  console.log(`✅ Deleted ${attResult.deletedCount} attendance records.`);

  const partResult = await db.collection('participationrecords').deleteMany({});
  console.log(`✅ Deleted ${partResult.deletedCount} participation records.`);

  const txResult = await db.collection('credittransactions').deleteMany({});
  console.log(`✅ Deleted ${txResult.deletedCount} credit transactions.`);

  const goodiesResult = await db.collection('rankgoodies').deleteMany({});
  console.log(`✅ Deleted ${goodiesResult.deletedCount} rank goodies.`);

  const auditResult = await db.collection('auditlogs').deleteMany({});
  console.log(`✅ Deleted ${auditResult.deletedCount} audit log entries.`);

  // 3. Reset all student balances to 0 and level to Explorer
  const studentResetResult = await db.collection('students').updateMany(
    {},
    {
      $set: {
        cachedTotalCredits: 0,
        currentLevel: 'Explorer',
        updatedAt: new Date(),
      },
    }
  );
  console.log(`✅ Reset credit balances to 0 for ${studentResetResult.modifiedCount} students.`);

  // 4. Clean up volunteer user accounts created during workshop tests (keep default Admin)
  const volDeleteResult = await db.collection('users').deleteMany({
    role: 'VOLUNTEER',
  });
  console.log(`✅ Purged ${volDeleteResult.deletedCount} temporary volunteer user accounts.`);

  console.log('\n====================================================');
  console.log('  🎉 DATABASE FULLY CLEANED & RESET TO ZERO CREDITS');
  console.log('     NO SAMPLE WORKSHOPS REMAIN IN SYSTEM');
  console.log('====================================================\n');

  await mongoose.disconnect();
  console.log('Database connection closed.');
}

purgeAndResetDatabase().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
