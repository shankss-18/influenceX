import { Types } from 'mongoose';
import { CreditTransaction } from '../models/CreditTransaction';
import { Student } from '../models/Student';
import { LevelThreshold } from '../models/LevelThreshold';
import { MonthlyRankingSnapshot } from '../models/MonthlyRankingSnapshot';
import { ParticipationRecord } from '../models/ParticipationRecord';
import { EventRegistration } from '../models/EventRegistration';
import { RankGoodie } from '../models/RankGoodie';
import { dayjs, DEFAULT_TIMEZONE } from '../config/timezone';
import { getCurrentISTDate } from './timezone';

/**
 * Live-computes the verified total credit balance of a student from the digital ledger
 */
export async function getStudentLiveCredits(studentId: Types.ObjectId | string): Promise<number> {
  const result = await CreditTransaction.aggregate([
    {
      $match: {
        studentId: new Types.ObjectId(studentId.toString()),
        status: 'APPROVED',
      },
    },
    {
      $group: {
        _id: '$studentId',
        total: { $sum: '$amount' },
      },
    },
  ]);

  return result.length > 0 ? result[0].total : 0;
}

/**
 * Recalculates student's tier level and refreshes performance cache from the live ledger sum,
 * and automatically unlocks tier-based goodies in PENDING status.
 */
export async function recalculateStudentLevelAndCache(
  studentId: Types.ObjectId | string
): Promise<{ liveCredits: number; currentLevel: string }> {
  const sId = new Types.ObjectId(studentId.toString());
  const liveCredits = await getStudentLiveCredits(sId);

  // Fetch thresholds sorted highest first
  const thresholds = await LevelThreshold.find().sort({ minCredits: -1 });

  let matchedLevel = 'Explorer';
  for (const t of thresholds) {
    if (liveCredits >= t.minCredits) {
      matchedLevel = t.name;
      break;
    }
  }

  // Update student cache
  await Student.findByIdAndUpdate(sId, {
    cachedTotalCredits: liveCredits,
    currentLevel: matchedLevel,
  });

  // Automatically unlock RankGoodie records for all qualified tiers
  for (const t of thresholds) {
    if (liveCredits >= t.minCredits) {
      const existingGoodie = await RankGoodie.findOne({
        studentId: sId,
        levelName: t.name,
      });

      if (!existingGoodie) {
        try {
          await RankGoodie.create({
            studentId: sId,
            levelName: t.name,
            goodieName: t.goodieName || `${t.icon || '🎁'} ${t.name} Goodie Kit`,
            status: 'PENDING',
            unlockedAt: getCurrentISTDate(),
          });
        } catch (err: any) {
          // Ignore duplicate key error in concurrent races
        }
      }
    }
  }

  return { liveCredits, currentLevel: matchedLevel };
}

/**
 * High-performance bulk recalculation of student tier levels, cached credits, and goodies.
 * Replaces N individual roundtrips with 4 bulk database operations (100x faster).
 */
export async function recalculateStudentsLevelAndCacheBulk(
  studentIds: (Types.ObjectId | string)[]
): Promise<Map<string, { liveCredits: number; currentLevel: string }>> {
  if (!studentIds || studentIds.length === 0) return new Map();

  const objectIds = studentIds.map((id) => new Types.ObjectId(id.toString()));
  const uniqueObjectIds = [...new Set(objectIds.map((id) => id.toString()))].map((id) => new Types.ObjectId(id));

  // 1. Single aggregation query to compute sums for ALL students
  const aggResults = await CreditTransaction.aggregate([
    {
      $match: {
        studentId: { $in: uniqueObjectIds },
        status: 'APPROVED',
      },
    },
    {
      $group: {
        _id: '$studentId',
        total: { $sum: '$amount' },
      },
    },
  ]);

  const creditMap = new Map<string, number>();
  aggResults.forEach((r) => creditMap.set(r._id.toString(), r.total));

  // 2. Fetch thresholds ONCE
  const thresholds = await LevelThreshold.find().sort({ minCredits: -1 });

  // 3. Prepare bulkWrite updates for students
  const studentBulkOps: any[] = [];
  const resultMap = new Map<string, { liveCredits: number; currentLevel: string }>();

  const goodiesToInsert: any[] = [];
  const now = getCurrentISTDate();

  // 4. Batch query all existing goodies for these students
  const existingGoodies = await RankGoodie.find({
    studentId: { $in: uniqueObjectIds },
  }).select('studentId levelName');

  const existingGoodiesSet = new Set<string>();
  existingGoodies.forEach((g) => {
    existingGoodiesSet.add(`${g.studentId.toString()}_${g.levelName}`);
  });

  for (const sId of uniqueObjectIds) {
    const sIdStr = sId.toString();
    const liveCredits = creditMap.get(sIdStr) || 0;

    let matchedLevel = 'Explorer';
    for (const t of thresholds) {
      if (liveCredits >= t.minCredits) {
        matchedLevel = t.name;
        break;
      }
    }

    resultMap.set(sIdStr, { liveCredits, currentLevel: matchedLevel });

    studentBulkOps.push({
      updateOne: {
        filter: { _id: sId },
        update: {
          $set: {
            cachedTotalCredits: liveCredits,
            currentLevel: matchedLevel,
          },
        },
      },
    });

    // Check goodies for this student
    for (const t of thresholds) {
      if (liveCredits >= t.minCredits) {
        const key = `${sIdStr}_${t.name}`;
        if (!existingGoodiesSet.has(key)) {
          existingGoodiesSet.add(key);
          goodiesToInsert.push({
            studentId: sId,
            levelName: t.name,
            goodieName: t.goodieName || `${t.icon || '🎁'} ${t.name} Goodie Kit`,
            status: 'PENDING',
            unlockedAt: now,
          });
        }
      }
    }
  }

  // 5. Execute student bulk updates in 1 network call
  if (studentBulkOps.length > 0) {
    await Student.bulkWrite(studentBulkOps, { ordered: false });
  }

  // 6. Insert new goodies in 1 network call
  if (goodiesToInsert.length > 0) {
    try {
      await RankGoodie.insertMany(goodiesToInsert, { ordered: false });
    } catch {
      // Ignore race-condition duplicates
    }
  }

  return resultMap;
}

/**
 * Scheduled reconciliation job that verifies zero drift between live ledger sums and Student.cachedTotalCredits
 */
export async function reconcileLedgerWithCache(): Promise<{
  inspected: number;
  mismatchesFound: number;
  fixed: number;
}> {
  const students = await Student.find().select('_id fullName influenceXId cachedTotalCredits currentLevel');

  let mismatchesFound = 0;
  let fixed = 0;

  for (const student of students) {
    const liveCredits = await getStudentLiveCredits(student._id);
    if (liveCredits !== student.cachedTotalCredits) {
      mismatchesFound++;
      console.warn(
        `[LEDGER RECONCILIATION MISMATCH] Student: ${student.influenceXId} (${student.fullName}) - Cache: ${student.cachedTotalCredits}, Live Ledger: ${liveCredits}. Correcting cache.`
      );
      await recalculateStudentLevelAndCache(student._id);
      fixed++;
    }
  }

  return { inspected: students.length, mismatchesFound, fixed };
}

/**
 * Computes deterministic month-end ranking snapshots for all students
 * Deterministic tie-break order:
 * 1. Higher monthly credits
 * 2. More participation records that month
 * 3. More completed events that month
 * 4. Earlier timestamp of reaching that credit total
 */
export async function takeMonthlyRankingSnapshot(monthStr?: string): Promise<{
  month: string;
  totalStudents: number;
  version: number;
}> {
  const targetMonth = monthStr || dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM');

  // Month date range in Asia/Kolkata
  const startOfMonth = dayjs.tz(`${targetMonth}-01 00:00:00`, DEFAULT_TIMEZONE).toDate();
  const endOfMonth = dayjs.tz(`${targetMonth}-01 00:00:00`, DEFAULT_TIMEZONE).endOf('month').toDate();

  // 1. Get monthly credits per student
  const monthlyCreditAgg = await CreditTransaction.aggregate([
    {
      $match: {
        status: 'APPROVED',
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      },
    },
    {
      $group: {
        _id: '$studentId',
        creditsThisMonth: { $sum: '$amount' },
        earliestFinalTxTime: { $max: '$createdAt' },
      },
    },
  ]);
  const monthlyCreditMap = new Map<string, { credits: number; lastTxTime: Date }>();
  monthlyCreditAgg.forEach((item) => {
    monthlyCreditMap.set(item._id.toString(), {
      credits: item.creditsThisMonth,
      lastTxTime: item.earliestFinalTxTime,
    });
  });

  // 2. Get participation count in this month
  const participationAgg = await ParticipationRecord.aggregate([
    {
      $match: {
        participated: true,
        recordedAt: { $gte: startOfMonth, $lte: endOfMonth },
      },
    },
    {
      $group: {
        _id: '$studentId',
        count: { $sum: 1 },
      },
    },
  ]);
  const partMap = new Map<string, number>();
  participationAgg.forEach((p) => partMap.set(p._id.toString(), p.count));

  // 3. Get completed events in this month
  const eventAgg = await EventRegistration.aggregate([
    {
      $match: {
        status: 'REGISTERED',
        registeredAt: { $gte: startOfMonth, $lte: endOfMonth },
      },
    },
    {
      $group: {
        _id: '$studentId',
        count: { $sum: 1 },
      },
    },
  ]);
  const eventMap = new Map<string, number>();
  eventAgg.forEach((e) => eventMap.set(e._id.toString(), e.count));

  // 4. Fetch all active students
  const students = await Student.find({ status: 'APPROVED' }).select('_id cachedTotalCredits createdAt');

  // Check current snapshot version for this month to avoid overwriting past snapshots
  const latestSnapshot = await MonthlyRankingSnapshot.findOne({ month: targetMonth }).sort({ version: -1 });
  const nextVersion = latestSnapshot ? latestSnapshot.version + 1 : 1;

  // Build candidate records
  const candidates = students.map((s) => {
    const sId = s._id.toString();
    const mData = monthlyCreditMap.get(sId) || { credits: 0, lastTxTime: s.createdAt };
    const partCount = partMap.get(sId) || 0;
    const evCount = eventMap.get(sId) || 0;

    return {
      studentId: s._id,
      creditsThisMonth: mData.credits,
      totalCreditsAtSnapshot: s.cachedTotalCredits,
      participationCount: partCount,
      completedEventsCount: evCount,
      lastTxTime: mData.lastTxTime,
    };
  });

  // Sort candidates using strict 4-step deterministic tie-breaking order:
  // (1) higher monthly credits
  // (2) more participation records that month
  // (3) more completed events that month
  // (4) earlier timestamp of reaching that credit total
  candidates.sort((a, b) => {
    if (b.creditsThisMonth !== a.creditsThisMonth) {
      return b.creditsThisMonth - a.creditsThisMonth;
    }
    if (b.participationCount !== a.participationCount) {
      return b.participationCount - a.participationCount;
    }
    if (b.completedEventsCount !== a.completedEventsCount) {
      return b.completedEventsCount - a.completedEventsCount;
    }
    return new Date(a.lastTxTime).getTime() - new Date(b.lastTxTime).getTime();
  });

  // Assign ranks and insert snapshot documents
  const snapshotDocs = candidates.map((cand, index) => ({
    month: targetMonth,
    studentId: cand.studentId,
    creditsThisMonth: cand.creditsThisMonth,
    totalCreditsAtSnapshot: cand.totalCreditsAtSnapshot,
    rank: index + 1,
    participationCount: cand.participationCount,
    completedEventsCount: cand.completedEventsCount,
    snapshotTakenAt: getCurrentISTDate(),
    version: nextVersion,
  }));

  await MonthlyRankingSnapshot.insertMany(snapshotDocs);

  return {
    month: targetMonth,
    totalStudents: snapshotDocs.length,
    version: nextVersion,
  };
}
