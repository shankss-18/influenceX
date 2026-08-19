import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Student } from '../models/Student';
import { CreditTransaction } from '../models/CreditTransaction';
import { Event } from '../models/Event';
import { EventRegistration } from '../models/EventRegistration';
import { Attendance } from '../models/Attendance';
import { ParticipationRecord } from '../models/ParticipationRecord';
import { RankGoodie } from '../models/RankGoodie';
import { LevelThreshold } from '../models/LevelThreshold';
import { MonthlyRankingSnapshot } from '../models/MonthlyRankingSnapshot';
import { takeMonthlyRankingSnapshot } from '../utils/ledger';
import { dayjs, DEFAULT_TIMEZONE } from '../config/timezone';

export async function getLeaderboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const scope = (req.query.scope as string) || 'all-time';
    const workshopId = req.query.workshopId as string;
    const tier = req.query.tier as string;
    const search = (req.query.search as string || '').trim().toLowerCase();

    // 1. Fetch workshops for the dropdown
    const allWorkshops = await Event.find().select('name eventId date').sort({ createdAt: -1 });

    // 2. Fetch level thresholds
    const thresholds = await LevelThreshold.find().sort({ order: 1 });
    const tierNames = ['Explorer', 'Rising', 'Creator', 'Leader', 'Icon'];

    let rankedList: Array<{
      rank: number;
      id: string;
      studentId: string;
      fullName: string;
      influenceXId: string;
      collegeStudentId: string;
      branch: string;
      year: number;
      totalCredits: number;
      currentLevel: string;
      levelBadgeColor?: string;
    }> = [];

    if (scope === 'workshop' && workshopId) {
      // Aggregate credits specifically for this workshop
      const agg = await CreditTransaction.aggregate([
        {
          $match: {
            eventId: new Types.ObjectId(workshopId),
            status: 'APPROVED',
          },
        },
        {
          $group: {
            _id: '$studentId',
            credits: { $sum: '$amount' },
          },
        },
        { $sort: { credits: -1 } },
      ]);

      const studentIds = agg.map((a) => a._id);
      const students = await Student.find({ _id: { $in: studentIds } });
      const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

      let rank = 1;
      for (const item of agg) {
        const student = studentMap.get(item._id.toString());
        if (!student) continue;

        rankedList.push({
          rank: rank++,
          id: student._id.toString(),
          studentId: student._id.toString(),
          fullName: student.fullName,
          influenceXId: student.influenceXId,
          collegeStudentId: student.collegeStudentId,
          branch: student.branch,
          year: student.year,
          totalCredits: item.credits,
          currentLevel: student.currentLevel || 'Explorer',
        });
      }
    } else if (scope === 'monthly') {
      const now = dayjs().tz(DEFAULT_TIMEZONE);
      const startOfMonth = now.startOf('month').toDate();
      const endOfMonth = now.endOf('month').toDate();

      const agg = await CreditTransaction.aggregate([
        {
          $match: {
            status: 'APPROVED',
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        {
          $group: {
            _id: '$studentId',
            credits: { $sum: '$amount' },
          },
        },
        { $sort: { credits: -1 } },
      ]);

      const studentIds = agg.map((a) => a._id);
      const students = await Student.find({ _id: { $in: studentIds } });
      const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

      let rank = 1;
      for (const item of agg) {
        const student = studentMap.get(item._id.toString());
        if (!student) continue;

        rankedList.push({
          rank: rank++,
          id: student._id.toString(),
          studentId: student._id.toString(),
          fullName: student.fullName,
          influenceXId: student.influenceXId,
          collegeStudentId: student.collegeStudentId,
          branch: student.branch,
          year: student.year,
          totalCredits: item.credits,
          currentLevel: student.currentLevel || 'Explorer',
        });
      }
    } else {
      // All-time scope from cached balances
      const students = await Student.find({ status: 'APPROVED' }).sort({ cachedTotalCredits: -1, createdAt: 1 });

      rankedList = students.map((s, idx) => ({
        rank: idx + 1,
        id: s._id.toString(),
        studentId: s._id.toString(),
        fullName: s.fullName,
        influenceXId: s.influenceXId,
        collegeStudentId: s.collegeStudentId,
        branch: s.branch,
        year: s.year,
        totalCredits: s.cachedTotalCredits || 0,
        currentLevel: s.currentLevel || 'Explorer',
      }));
    }

    // Compute tier distribution counts
    const tierCounts: Record<string, number> = {
      Explorer: 0,
      Rising: 0,
      Creator: 0,
      Leader: 0,
      Icon: 0,
    };
    rankedList.forEach((s) => {
      const lvl = s.currentLevel || 'Explorer';
      if (tierCounts[lvl] !== undefined) {
        tierCounts[lvl]++;
      }
    });

    // Apply Tier Filter
    let filtered = rankedList;
    if (tier && tier !== 'ALL') {
      filtered = filtered.filter((s) => s.currentLevel === tier);
    }

    // Apply Search Filter
    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.fullName.toLowerCase().includes(search) ||
          s.influenceXId.toLowerCase().includes(search) ||
          (s.collegeStudentId && s.collegeStudentId.toLowerCase().includes(search))
      );
    }

    res.status(200).json({
      success: true,
      scope,
      workshops: allWorkshops.map((w) => ({
        id: w._id.toString(),
        eventId: w.eventId,
        name: w.name,
        date: w.date,
      })),
      tierCounts,
      totalStudents: rankedList.length,
      filteredCount: filtered.length,
      rankings: filtered,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMonthlySnapshots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { month } = req.query;
    const query: any = {};
    if (month) query.month = month;
    const snapshots = await MonthlyRankingSnapshot.find(query).sort({ month: -1, rank: 1 }).limit(100);
    res.status(200).json({ success: true, count: snapshots.length, snapshots });
  } catch (error) {
    next(error);
  }
}

export async function triggerMonthlySnapshot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await takeMonthlyRankingSnapshot();
    res.status(200).json({ success: true, message: 'Monthly snapshot triggered successfully.', result });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin Comprehensive Student Inspection (Workshops, Halls, Breakdown, Goodies)
 */
export async function getStudentInspectionDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentId } = req.params;
    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    // 1. Fetch all registrations for this student
    const registrations = await EventRegistration.find({ studentId: student._id })
      .populate('eventId', 'eventId name date startTime endTime venue halls creditCap status')
      .sort({ createdAt: -1 });

    // 2. Fetch all credit transactions for this student
    const transactions = await CreditTransaction.find({
      studentId: student._id,
      status: 'APPROVED',
    }).sort({ createdAt: -1 });

    // 3. Fetch attendance records
    const attendanceRecords = await Attendance.find({ studentId: student._id });
    const attMap = new Map(attendanceRecords.map((a) => [a.eventId.toString(), a.status]));

    // 4. Fetch participation records
    const partRecords = await ParticipationRecord.find({ studentId: student._id });
    const partMap = new Map(partRecords.map((p) => [p.eventId.toString(), p]));

    // 5. Fetch rank goodies
    const goodies = await RankGoodie.find({ studentId: student._id }).sort({ unlockedAt: -1 });

    // Build workshops breakdown
    const workshopsBreakdown = registrations
      .map((r: any) => {
        const ev = r.eventId;
        if (!ev) return null;
        const evIdStr = ev._id.toString();
        const evTxs = transactions.filter((t) => t.eventId && t.eventId.toString() === evIdStr);

        const reg = evTxs.filter((t) => t.creditType === 'REGISTRATION').reduce((sum, t) => sum + t.amount, 0);
        const att = evTxs.filter((t) => t.creditType === 'ATTENDANCE').reduce((sum, t) => sum + t.amount, 0);
        const part = evTxs.filter((t) => t.creditType === 'PARTICIPATION').reduce((sum, t) => sum + t.amount, 0);
        const partDoc = partMap.get(evIdStr);

        return {
          workshopId: ev._id,
          eventId: ev.eventId,
          name: ev.name,
          date: ev.date,
          startTime: ev.startTime,
          endTime: ev.endTime,
          assignedHall: r.hallName || 'Pending Allocation',
          attendanceStatus: attMap.get(evIdStr) || 'NOT_MARKED',
          participationReason: partDoc?.notes || '',
          creditBreakdown: {
            registration: reg,
            attendance: att,
            participation: part,
            total: reg + att + part,
          },
        };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      student: {
        id: student._id,
        fullName: student.fullName,
        influenceXId: student.influenceXId,
        collegeStudentId: student.collegeStudentId,
        branch: student.branch,
        year: student.year,
        collegeEmail: student.collegeEmail,
        totalCredits: student.cachedTotalCredits || 0,
        currentLevel: student.currentLevel || 'Explorer',
      },
      workshops: workshopsBreakdown,
      goodies: goodies.map((g) => ({
        id: g._id,
        levelName: g.levelName,
        goodieName: g.goodieName,
        unlockedAt: g.unlockedAt,
        status: g.status,
        issuedAt: g.issuedAt,
        notes: g.notes,
      })),
    });
  } catch (error) {
    next(error);
  }
}
