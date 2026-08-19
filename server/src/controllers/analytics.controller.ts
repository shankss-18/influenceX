import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Student } from '../models/Student';
import { Event } from '../models/Event';
import { EventRegistration } from '../models/EventRegistration';
import { Attendance } from '../models/Attendance';
import { ParticipationRecord } from '../models/ParticipationRecord';
import { CreditTransaction } from '../models/CreditTransaction';
import { RewardClaim } from '../models/RewardClaim';
import { EventCategory } from '../models/EventCategory';
import { dayjs, DEFAULT_TIMEZONE, getCurrentISTDate } from '../utils/timezone';

interface CacheEntry {
  data: any;
  cachedAt: number;
}

const analyticsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export async function getDashboardAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const rangeMonths = parseInt(req.query.rangeMonths as string, 10) || 6;
    const cacheKey = `dashboard_analytics_${rangeMonths}`;

    const now = Date.now();
    const cached = analyticsCache.get(cacheKey);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      res.status(200).json({
        success: true,
        ...cached.data,
        isCached: true,
        cachedAt: new Date(cached.cachedAt).toISOString(),
      });
      return;
    }

    const currentIST = dayjs().tz(DEFAULT_TIMEZONE);
    const startOfCurrentMonth = currentIST.startOf('month').toDate();
    const rangeStartDate = currentIST.subtract(rangeMonths - 1, 'month').startOf('month').toDate();

    // 1. KPI Counts
    const [
      totalStudents,
      totalEvents,
      totalParticipation,
      creditAgg,
      rewardsDistributed,
      activeThisMonthStudentIds,
    ] = await Promise.all([
      Student.countDocuments({ status: { $ne: 'DISABLED' } }),
      Event.countDocuments(),
      ParticipationRecord.countDocuments({ participated: true }),
      CreditTransaction.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, totalCredits: { $sum: '$amount' } } },
      ]),
      RewardClaim.countDocuments({ status: 'DISTRIBUTED' }),
      // Active this month: distinct students with attendance OR credit transaction this month
      Promise.all([
        Attendance.distinct('studentId', { markedAt: { $gte: startOfCurrentMonth } }),
        CreditTransaction.distinct('studentId', {
          status: 'APPROVED',
          createdAt: { $gte: startOfCurrentMonth },
        }),
      ]).then(([attIds, credIds]) => {
        const uniqueSet = new Set([...attIds.map(String), ...credIds.map(String)]);
        return uniqueSet.size;
      }),
    ]);

    const totalCreditsAwarded = creditAgg.length > 0 ? creditAgg[0].totalCredits : 0;

    // 2. Action Items & Insights Counts
    const [
      pendingCreditApprovalsCount,
      pendingAttendanceCorrectionsCount,
      pendingRewardClaimsCount,
      studentsByLevelAgg,
    ] = await Promise.all([
      CreditTransaction.countDocuments({ status: 'PENDING_APPROVAL' }),
      Attendance.countDocuments({ correctionStatus: 'PENDING_APPROVAL' }),
      RewardClaim.countDocuments({ status: 'REQUESTED' }),
      Student.aggregate([
        { $match: { status: { $ne: 'DISABLED' } } },
        { $group: { _id: '$currentLevel', count: { $sum: 1 } } },
      ]),
    ]);

    // Format students by level
    const tierMap: Record<string, number> = {
      Explorer: 0,
      Rising: 0,
      Creator: 0,
      Leader: 0,
      Icon: 0,
    };
    studentsByLevelAgg.forEach((item) => {
      if (item._id && tierMap[item._id] !== undefined) {
        tierMap[item._id] = item.count;
      }
    });

    const studentsByLevel = Object.keys(tierMap).map((tier) => ({
      tier,
      count: tierMap[tier],
    }));

    // 3. Monthly Trends Pipeline (Past N months)
    const monthlyTrendsAgg = await Event.aggregate([
      {
        $match: {
          date: { $gte: rangeStartDate },
        },
      },
      {
        $project: {
          month: {
            $dateToString: { format: '%Y-%m', date: '$date', timezone: DEFAULT_TIMEZONE },
          },
          registeredCount: 1,
        },
      },
      {
        $group: {
          _id: '$month',
          eventCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Monthly credits distributed pipeline
    const monthlyCreditsAgg = await CreditTransaction.aggregate([
      {
        $match: {
          status: 'APPROVED',
          createdAt: { $gte: rangeStartDate },
        },
      },
      {
        $project: {
          month: {
            $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: DEFAULT_TIMEZONE },
          },
          amount: 1,
        },
      },
      {
        $group: {
          _id: '$month',
          creditsDistributed: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Monthly attendance & participation counts
    const monthlyAttendanceAgg = await Attendance.aggregate([
      {
        $match: {
          markedAt: { $gte: rangeStartDate },
        },
      },
      {
        $project: {
          month: {
            $dateToString: { format: '%Y-%m', date: '$markedAt', timezone: DEFAULT_TIMEZONE },
          },
          status: 1,
        },
      },
      {
        $group: {
          _id: '$month',
          totalMarked: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] },
          },
        },
      },
    ]);

    const monthlyParticipationAgg = await ParticipationRecord.aggregate([
      {
        $match: {
          participated: true,
          recordedAt: { $gte: rangeStartDate },
        },
      },
      {
        $project: {
          month: {
            $dateToString: { format: '%Y-%m', date: '$recordedAt', timezone: DEFAULT_TIMEZONE },
          },
        },
      },
      {
        $group: {
          _id: '$month',
          participatedCount: { $sum: 1 },
        },
      },
    ]);

    // Build complete month-by-month array
    const monthlyMap: Record<string, any> = {};
    for (let i = rangeMonths - 1; i >= 0; i--) {
      const mStr = currentIST.subtract(i, 'month').format('YYYY-MM');
      monthlyMap[mStr] = {
        month: mStr,
        eventCount: 0,
        creditsDistributed: 0,
        presentCount: 0,
        participatedCount: 0,
      };
    }

    monthlyTrendsAgg.forEach((item) => {
      if (monthlyMap[item._id]) monthlyMap[item._id].eventCount = item.eventCount;
    });
    monthlyCreditsAgg.forEach((item) => {
      if (monthlyMap[item._id]) monthlyMap[item._id].creditsDistributed = item.creditsDistributed;
    });
    monthlyAttendanceAgg.forEach((item) => {
      if (monthlyMap[item._id]) monthlyMap[item._id].presentCount = item.presentCount;
    });
    monthlyParticipationAgg.forEach((item) => {
      if (monthlyMap[item._id]) monthlyMap[item._id].participatedCount = item.participatedCount;
    });

    const monthlyTrends = Object.values(monthlyMap);

    // 4. Category-wise Breakdown Pipeline
    const categoryBreakdownAgg = await Event.aggregate([
      {
        $lookup: {
          from: 'eventcategories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          categoryName: { $first: '$category.name' },
          eventCount: { $sum: 1 },
        },
      },
      { $sort: { eventCount: -1 } },
    ]);

    // 5. Top 10 Students Overall
    const topStudentsAgg = await Student.find({ status: { $ne: 'DISABLED' } })
      .select('influenceXId fullName branch year currentLevel cachedTotalCredits')
      .sort({ cachedTotalCredits: -1, createdAt: 1 })
      .limit(10)
      .lean();

    // 6. Highlight Insights
    const mostPopularEvent = await Event.findOne()
      .sort({ registeredCount: -1 })
      .select('name eventId registeredCount')
      .lean();

    const payload = {
      kpis: {
        totalStudents,
        activeThisMonth: activeThisMonthStudentIds,
        totalEvents,
        totalParticipation,
        totalCreditsAwarded,
        rewardsDistributed,
      },
      actionQueues: {
        pendingCreditApprovalsCount,
        pendingAttendanceCorrectionsCount,
        pendingRewardClaimsCount,
      },
      studentsByLevel,
      monthlyTrends,
      categoryBreakdown: categoryBreakdownAgg,
      topStudents: topStudentsAgg.map((s, idx) => ({
        rank: idx + 1,
        id: s._id,
        influenceXId: s.influenceXId,
        fullName: s.fullName,
        branch: s.branch,
        year: s.year,
        currentLevel: s.currentLevel,
        credits: s.cachedTotalCredits,
      })),
      insights: {
        highestParticipationEvent: mostPopularEvent
          ? {
              eventId: mostPopularEvent.eventId,
              name: mostPopularEvent.name,
              registeredCount: (mostPopularEvent as any).registeredCount || 0,
            }
          : null,
        bestPerformingCategory:
          categoryBreakdownAgg.length > 0 ? categoryBreakdownAgg[0].categoryName : 'Workshop',
        pendingActionCount:
          pendingCreditApprovalsCount +
          pendingAttendanceCorrectionsCount +
          pendingRewardClaimsCount,
      },
      serverTimeIST: currentIST.format('YYYY-MM-DD HH:mm:ss [IST]'),
    };

    // Cache the result for 60s
    analyticsCache.set(cacheKey, {
      data: payload,
      cachedAt: now,
    });

    res.status(200).json({
      success: true,
      ...payload,
      isCached: false,
      cachedAt: new Date(now).toISOString(),
    });
  } catch (error) {
    console.error('[Analytics] Error aggregating dashboard data:', error);
    res.status(500).json({ error: 'Failed to aggregate analytics data. Please try again.' });
  }
}
