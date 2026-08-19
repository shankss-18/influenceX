import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/influencex_dev';

async function resetAndRecalculateAllCredits() {
  console.log('====================================================');
  console.log('   INFLUENCEX DATABASE CREDIT RESET & RE-VERIFY     ');
  console.log('====================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB:', MONGO_URI);

  const db = mongoose.connection.db;

  // 1. Fetch collections
  const studentsCollection = db.collection('students');
  const transactionsCollection = db.collection('credittransactions');
  const thresholdsCollection = db.collection('levelthresholds');
  const rankGoodiesCollection = db.collection('rankgoodies');

  // Fetch thresholds
  const thresholds = await thresholdsCollection.find({}).sort({ order: 1 }).toArray();
  console.log(`Loaded ${thresholds.length} level thresholds.`);

  // 2. Fetch all approved students
  const students = await studentsCollection.find({}).toArray();
  console.log(`Found ${students.length} total students in database.\n`);

  let resetCount = 0;

  for (const student of students) {
    // Sum valid approved transactions for this student
    const agg = await transactionsCollection.aggregate([
      {
        $match: {
          studentId: student._id,
          status: 'APPROVED',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]).toArray();

    const verifiedTotal = agg.length > 0 ? agg[0].total : 0;

    // Determine correct level tier
    let calculatedLevel = 'Explorer';
    for (const t of thresholds) {
      if (verifiedTotal >= t.minCredits) {
        calculatedLevel = t.name;
      }
    }

    await studentsCollection.updateOne(
      { _id: student._id },
      {
        $set: {
          cachedTotalCredits: verifiedTotal,
          currentLevel: calculatedLevel,
          updatedAt: new Date(),
        },
      }
    );

    // Sync RankGoodie record
    const currentTierDoc = thresholds.find((t) => t.name === calculatedLevel);
    if (currentTierDoc && currentTierDoc.goodieName) {
      const existingGoodie = await rankGoodiesCollection.findOne({
        studentId: student._id,
        levelName: calculatedLevel,
      });

      if (!existingGoodie) {
        await rankGoodiesCollection.insertOne({
          studentId: student._id,
          levelName: calculatedLevel,
          goodieName: currentTierDoc.goodieName,
          unlockedAt: new Date(),
          status: 'PENDING',
          issuedAt: null,
          issuedBy: null,
          notes: '',
        });
      }
    }

    resetCount++;
  }

  console.log(`✅ Successfully verified and synchronized ${resetCount} student credit balances.`);
  console.log('✅ Credit ledger is 100% mathematically consistent with approved transactions.\n');

  await mongoose.disconnect();
  console.log('Database connection closed.');
}

resetAndRecalculateAllCredits().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
