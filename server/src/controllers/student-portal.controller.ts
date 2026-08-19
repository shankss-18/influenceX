import { Request, Response, NextFunction } from 'express';
import { Student } from '../models/Student';
import { Event } from '../models/Event';
import { EventRegistration } from '../models/EventRegistration';
import { Attendance } from '../models/Attendance';
import { CreditTransaction } from '../models/CreditTransaction';
import { LevelThreshold } from '../models/LevelThreshold';
import { RankGoodie } from '../models/RankGoodie';
import { getCurrentISTDate } from '../utils/timezone';

/**
 * Screen: Student Single Page — Get Unified Portal Dashboard Data
 * Strictly scoped server-side to req.user._id
 */
export async function getStudentPortalData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const student = await Student.findOne({
      $or: [
        { userId: user._id },
        { influenceXId: user.ixId },
        { influenceXId: new RegExp(`^${user.ixId || ''}$`, 'i') },
        { collegeEmail: user.email?.toLowerCase() },
      ],
    });

    if (!student) {
      res.status(404).json({
        success: false,
        error: 'Student record not found for this user account.',
      });
      return;
    }

    const now = getCurrentISTDate();

    // 1. LIVE CREDIT SUMMARY & LEVEL PROGRESS
    const levels = await LevelThreshold.find({}).sort({ order: 1 });
    const currentLevelDoc = levels.find((l) => l.name === student.currentLevel) || levels[0];
    const nextLevelDoc = levels.find((l) => l.order === (currentLevelDoc?.order || 1) + 1);

    const totalCredits = student.cachedTotalCredits || 0;
    const currentTierMin = currentLevelDoc ? currentLevelDoc.minCredits : 0;
    const nextTierMin = nextLevelDoc ? nextLevelDoc.minCredits : currentTierMin;

    const progressPercentage = nextLevelDoc
      ? Math.min(100, Math.max(0, Math.round(((totalCredits - currentTierMin) / (nextTierMin - currentTierMin || 1)) * 100)))
      : 100;

    const creditsNeededForNext = nextLevelDoc ? Math.max(0, nextTierMin - totalCredits) : 0;

    // 2. LEADERBOARD POSITION & TOP 10
    const allStudents = await Student.find({ status: 'APPROVED' })
      .select('fullName influenceXId cachedTotalCredits currentLevel')
      .sort({ cachedTotalCredits: -1, createdAt: 1 });

    const totalApproved = allStudents.length;
    const overallRank = allStudents.findIndex((s) => s._id.toString() === student._id.toString()) + 1 || 1;

    const sameLevelStudents = allStudents.filter((s) => s.currentLevel === student.currentLevel);
    const categoryRank = sameLevelStudents.findIndex((s) => s._id.toString() === student._id.toString()) + 1 || 1;

    const top10List = allStudents.slice(0, 10).map((s, index) => ({
      rank: index + 1,
      studentId: s._id,
      fullName: s.fullName,
      influenceXId: s.influenceXId,
      credits: s.cachedTotalCredits || 0,
      currentLevel: s.currentLevel,
      isCurrentUser: s._id.toString() === student._id.toString(),
    }));

    const isUserInTop10 = overallRank <= 10;
    const userLeaderboardRow = {
      rank: overallRank,
      studentId: student._id,
      fullName: student.fullName,
      influenceXId: student.influenceXId,
      credits: totalCredits,
      currentLevel: student.currentLevel,
      isCurrentUser: true,
    };

    // 3. REGISTERED WORKSHOPS (STATUS-AWARE)
    const registrations = await EventRegistration.find({ studentId: student._id })
      .populate('eventId')
      .sort({ registeredAt: -1 });

    const registeredWorkshops = await Promise.all(
      registrations.map(async (reg: any) => {
        const workshop = reg.eventId;
        if (!workshop) return null;

        // Fetch attendance record for this workshop
        const attendance = await Attendance.findOne({
          eventId: workshop._id,
          studentId: student._id,
        });

        // Fetch credit transaction breakdown
        const transactions = await CreditTransaction.find({
          eventId: workshop._id,
          studentId: student._id,
          status: 'APPROVED',
        });

        const regCredits = transactions.filter((t) => t.creditType === 'REGISTRATION').reduce((sum, t) => sum + t.amount, 0);
        const attCredits = transactions.filter((t) => t.creditType === 'ATTENDANCE').reduce((sum, t) => sum + t.amount, 0);
        const partCredits = transactions.filter((t) => t.creditType === 'PARTICIPATION').reduce((sum, t) => sum + t.amount, 0);
        const totalCreditsEarned = regCredits + attCredits + partCredits;

        let statusCategory: 'Registered — hall pending' | 'Registered — hall assigned' | 'Attended' | 'Missed';

        if (attendance && attendance.status === 'PRESENT') {
          statusCategory = 'Attended';
        } else if (workshop.status === 'Ended' || workshop.status === 'COMPLETED') {
          statusCategory = 'Missed';
        } else if (!workshop.studentsSetupCompleted || !reg.hallName || reg.isWaitlisted) {
          statusCategory = 'Registered — hall pending';
        } else {
          statusCategory = 'Registered — hall assigned';
        }

        return {
          id: workshop._id,
          eventId: workshop.eventId,
          name: workshop.name,
          description: workshop.description,
          date: workshop.date,
          startTime: workshop.startTime,
          endTime: workshop.endTime,
          venue: workshop.venue,
          assignedHall: reg.hallName,
          assignedOrder: reg.assignedOrder,
          statusCategory,
          creditBreakdown: {
            registration: regCredits,
            attendance: attCredits,
            participation: partCredits,
            total: totalCreditsEarned,
          },
        };
      })
    );

    const validRegisteredWorkshops = registeredWorkshops.filter(Boolean);
    const registeredEventIds = registrations.map((r) => r.eventId?._id?.toString()).filter(Boolean);

    // 4. UPCOMING WORKSHOPS WITH OPEN REGISTRATION FORM LINK
    const availableEvents = await Event.find({
      _id: { $nin: registeredEventIds },
      status: { $ne: 'Ended' },
      registrationFormUrl: { $exists: true, $ne: '' },
    }).sort({ date: 1 });

    const upcomingWorkshops = availableEvents.map((ev) => ({
      id: ev._id,
      eventId: ev.eventId,
      name: ev.name,
      description: ev.description,
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      venue: ev.venue,
      registrationFormUrl: ev.registrationFormUrl,
      notice: "Registration submitted — you'll be confirmed once the organizing team finalizes the roster",
    }));

    // 5. FETCH GOODIE STATUS (PENDING vs ISSUED)
    const rankGoodies = await RankGoodie.find({ studentId: student._id });
    const currentGoodie = rankGoodies.find((g) => g.levelName === student.currentLevel);

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
      },
      creditsSummary: {
        totalCredits,
        currentLevel: student.currentLevel,
        currentLevelNumber: currentLevelDoc?.order || 1,
        nextLevel: nextLevelDoc?.name || null,
        nextThreshold: nextTierMin,
        progressPercentage,
        creditsNeededForNext,
        goodieReward: currentLevelDoc?.goodieName || null,
        goodieStatus: currentGoodie ? currentGoodie.status : 'PENDING',
        goodieIssuedAt: currentGoodie?.issuedAt || null,
      },
      leaderboard: {
        overallRank,
        totalStudents: totalApproved,
        categoryRank,
        categoryName: student.currentLevel,
        top10: top10List,
        isUserInTop10,
        userLeaderboardRow,
      },
      registeredWorkshops: validRegisteredWorkshops,
      upcomingWorkshops,
    });
  } catch (error) {
    next(error);
  }
}
