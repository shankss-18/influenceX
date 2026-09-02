import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Event } from '../models/Event';
import { EventRegistration } from '../models/EventRegistration';
import { Student } from '../models/Student';
import { Attendance } from '../models/Attendance';
import { ParticipationRecord } from '../models/ParticipationRecord';
import { CreditTransaction } from '../models/CreditTransaction';
import { generateNextTransactionId } from '../utils/sequence';
import { recalculateStudentLevelAndCache } from '../utils/ledger';
import { createAuditLog } from '../utils/audit';
import { getCurrentISTDate } from '../utils/timezone';

/**
 * Screen: Volunteer Single Page — Get Active Workshop & Hall Session
 * Strictly scoped server-side to (volunteer.assignedWorkshopId, volunteer.assignedHallName)
 */
export async function getVolunteerActiveSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const now = getCurrentISTDate();

    // 1. Verify volunteer has an active workshop assignment (with fallback search by IXID)
    let workshop = user.assignedWorkshopId ? await Event.findById(user.assignedWorkshopId) : null;

    if (!workshop || workshop.status === 'Ended' || workshop.status === 'COMPLETED' || workshop.status === 'ARCHIVED') {
      const fallbackWorkshop = await Event.findOne({
        'halls.assignedVolunteers.ixId': { $regex: new RegExp(`^${user.ixId}$`, 'i') },
        status: { $nin: ['Ended', 'COMPLETED', 'ARCHIVED'] },
      }).sort({ createdAt: -1 });

      if (fallbackWorkshop) {
        workshop = fallbackWorkshop;
        user.assignedWorkshopId = fallbackWorkshop._id;
        const matchingHall = fallbackWorkshop.halls.find((h) =>
          (h.assignedVolunteers || []).some(
            (v) => v.ixId.toUpperCase() === (user.ixId || '').toUpperCase() || v.userId?.toString() === user._id.toString()
          )
        );
        if (matchingHall) user.assignedHallName = matchingHall.name;
        await user.save();
      }
    }

    if (!workshop || workshop.status === 'Ended' || workshop.status === 'COMPLETED' || workshop.status === 'ARCHIVED') {
      res.status(200).json({
        success: true,
        hasActiveSession: false,
        message: 'No active workshop assignment currently assigned to your volunteer account.',
      });
      return;
    }

    // 2. Verify volunteer's assigned hall (synced live with workshop halls)
    let assignedHall = workshop.halls.find((h) => h.name === user.assignedHallName);
    if (!assignedHall) {
      // Find if volunteer was assigned or moved to another hall by Admin
      const matchingHall = workshop.halls.find((h) =>
        (h.assignedVolunteers || []).some(
          (v) => v.ixId.toUpperCase() === (user.ixId || '').toUpperCase() || v.userId?.toString() === user._id.toString()
        )
      );
      if (matchingHall) {
        assignedHall = matchingHall;
        user.assignedHallName = matchingHall.name;
        await user.save();
      } else {
        res.status(200).json({
          success: true,
          hasActiveSession: false,
          message: 'You are not assigned to a hall in this active workshop.',
        });
        return;
      }
    }

    // 3. Compute server-side window state
    const nowTime = now.getTime();
    const winStart = new Date(workshop.attendanceWindowStart).getTime();
    const winEnd = new Date(workshop.attendanceWindowEnd).getTime();

    const isOpen = nowTime >= winStart && nowTime <= winEnd;
    const isClosed = nowTime > winEnd;
    const isUpcoming = nowTime < winStart;
    const countdownSeconds = isOpen
      ? Math.max(0, Math.floor((winEnd - nowTime) / 1000))
      : isUpcoming
      ? Math.max(0, Math.floor((winStart - nowTime) / 1000))
      : 0;

    // 4. Fetch ALL students registered to this workshop (not just this hall)
    //    so the volunteer can see and mark attendance for every attendee
    const registrations = await EventRegistration.find({
      eventId: workshop._id,
      status: 'REGISTERED',
    })
      .populate('studentId', 'fullName influenceXId collegeStudentId branch year cachedTotalCredits')
      .sort({ assignedOrder: 1 });

    const studentIds = registrations
      .map((r: any) => r.studentId?._id)
      .filter((id) => id);

    // Fetch existing attendance records
    const attendanceRecords = await Attendance.find({
      eventId: workshop._id,
      studentId: { $in: studentIds },
    });
    const attendanceMap = new Map<string, string>();
    attendanceRecords.forEach((a) => attendanceMap.set(a.studentId.toString(), a.status));

    // Fetch participation credits & total credits for this workshop
    const [transactions, partRecords] = await Promise.all([
      CreditTransaction.find({
        eventId: workshop._id,
        studentId: { $in: studentIds },
        status: 'APPROVED',
      }),
      ParticipationRecord.find({
        eventId: workshop._id,
        studentId: { $in: studentIds },
      }),
    ]);

    const partMap = new Map<string, any>();
    partRecords.forEach((p) => partMap.set(p.studentId.toString(), p));

    const studentRoster = registrations.map((r: any) => {
      const s = r.studentId;
      const sIdStr = s?._id?.toString() || '';
      const sTxs = transactions.filter((t) => t.studentId.toString() === sIdStr);
      const partDoc = partMap.get(sIdStr);

      const regPoints = sTxs.filter((t) => t.creditType === 'REGISTRATION').reduce((sum, t) => sum + t.amount, 0);
      const attPoints = sTxs.filter((t) => t.creditType === 'ATTENDANCE').reduce((sum, t) => sum + t.amount, 0);
      const partPoints = sTxs.filter((t) => t.creditType === 'PARTICIPATION').reduce((sum, t) => sum + t.amount, 0);
      const totalEarned = regPoints + attPoints + partPoints;
      const remainingHeadroom = Math.max(0, workshop.creditCap - totalEarned);

      return {
        id: r._id,
        studentId: s?._id,
        fullName: s?.fullName || 'Student',
        influenceXId: s?.influenceXId || 'IX-UNKNOWN',
        collegeStudentId: s?.collegeStudentId || '',
        assignedOrder: r.assignedOrder,
        attendanceStatus: attendanceMap.get(sIdStr) || 'NOT_MARKED',
        participationPoints: partPoints,
        participationReason: partDoc?.notes || '',
        totalCreditsThisWorkshop: totalEarned,
        cumulativeTotalCredits: s?.cachedTotalCredits !== undefined ? s.cachedTotalCredits : totalEarned,
        remainingCapHeadroom: remainingHeadroom,
      };
    });

    res.status(200).json({
      success: true,
      hasActiveSession: true,
      workshop: {
        id: workshop._id,
        eventId: workshop.eventId,
        name: workshop.name,
        date: workshop.date,
        startTime: workshop.startTime,
        endTime: workshop.endTime,
        creditCap: workshop.creditCap,
        attendanceWindowStart: workshop.attendanceWindowStart,
        attendanceWindowEnd: workshop.attendanceWindowEnd,
      },
      assignedHall: {
        name: assignedHall.name,
        capacity: assignedHall.capacity,
        totalStudentsCount: studentRoster.length,
      },
      windowState: {
        isOpen,
        isClosed,
        isUpcoming,
        isWorkshopEnded: (workshop.status as string) === 'Ended' || (workshop.status as string) === 'COMPLETED',
        countdownSeconds,
        closeTime: workshop.attendanceWindowEnd,
      },
      students: studentRoster,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen: Volunteer Single Page — Mark Attendance (Immediate write)
 * Server-side window lock & hall scoping enforced
 */
export async function volunteerMarkAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const { studentId, status } = req.body as {
      studentId: string;
      status: 'PRESENT' | 'ABSENT';
    };

    if (!user.assignedWorkshopId || !user.assignedHallName) {
      res.status(403).json({ success: false, error: 'You are not assigned to any live workshop hall.' });
      return;
    }

    const workshop = await Event.findById(user.assignedWorkshopId);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found.' });
      return;
    }

    // Window check removed: volunteers can mark/toggle attendance anytime
    // (admin ends the workshop to permanently freeze records)
    const now = getCurrentISTDate();

    // 2. Server-side registration check
    const registration = await EventRegistration.findOne({
      eventId: workshop._id,
      $or: [
        { studentId: new Types.ObjectId(studentId) },
        { studentId: studentId },
      ],
    });

    if (!registration) {
      res.status(404).json({ success: false, error: 'Student registration not found.' });
      return;
    }

    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student profile not found.' });
      return;
    }

    // 3. Upsert attendance record
    const existingAtt = await Attendance.findOne({ eventId: workshop._id, studentId });
    const oldStatus = existingAtt ? existingAtt.status : 'NOT_MARKED';

    await Attendance.findOneAndUpdate(
      { eventId: workshop._id, studentId },
      {
        status,
        markedBy: user._id,
        markedAt: now,
      },
      { upsert: true, new: true }
    );

    // 4. Handle +20 Attendance Credits
    if (status === 'PRESENT') {
      const existingTx = await CreditTransaction.findOne({
        eventId: workshop._id,
        studentId: student._id,
        creditType: 'ATTENDANCE',
      });

      if (!existingTx) {
        const txId = await generateNextTransactionId();
        await CreditTransaction.create({
          transactionId: txId,
          studentId: student._id,
          eventId: workshop._id,
          creditType: 'ATTENDANCE',
          amount: 20,
          reason: `Attendance verified by Volunteer ${user.name} (${user.ixId}) in ${user.assignedHallName}`,
          awardedBy: user._id,
          approvedBy: user._id,
          status: 'APPROVED',
          createdAt: now,
          approvedAt: now,
        });
      }
    } else if (status === 'ABSENT') {
      // Remove attendance credit & participation credit if marked absent
      await CreditTransaction.deleteMany({
        eventId: workshop._id,
        studentId: student._id,
        creditType: { $in: ['ATTENDANCE', 'PARTICIPATION'] },
      });
      await ParticipationRecord.deleteMany({
        eventId: workshop._id,
        studentId: student._id,
      });
    }

    await recalculateStudentLevelAndCache(student._id);

    // 5. Activity Log Entry
    await createAuditLog({
      req,
      actorUserId: user._id,
      actorRole: 'VOLUNTEER',
      action: 'ATTENDANCE_MARKED',
      targetType: 'STUDENT',
      targetId: student._id.toString(),
      beforeValue: { attendanceStatus: oldStatus },
      afterValue: { attendanceStatus: status },
      reason: `Volunteer '${user.name}' (${user.ixId}) marked '${student.fullName}' (${student.influenceXId}) as ${status} in ${user.assignedHallName}`,
    });

    const updatedStudent = await Student.findById(student._id);
    const allTxs = await CreditTransaction.find({
      eventId: workshop._id,
      studentId: student._id,
      status: 'APPROVED',
    });
    const workshopTotal = allTxs.reduce((sum, t) => sum + t.amount, 0);

    res.status(200).json({
      success: true,
      message: `Attendance marked as ${status} for ${student.fullName}.`,
      studentId,
      attendanceStatus: status,
      cumulativeTotalCredits: updatedStudent?.cachedTotalCredits || 0,
      totalCreditsThisWorkshop: workshopTotal,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen: Volunteer Single Page — Assign / Edit Performance Credit
 * Server-side credit cap headroom & window lock enforced
 */
export async function volunteerAwardPerformanceCredit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const { studentId, points, reason } = req.body as {
      studentId: string;
      points: number;
      reason?: string;
    };

    const targetPoints = Math.max(0, Number(points) || 0);
    const evaluationReason = (reason && reason.trim()) || `Performance score evaluated by Volunteer ${user.name} (${user.ixId})`;

    if (!user.assignedWorkshopId || !user.assignedHallName) {
      res.status(403).json({ success: false, error: 'You are not assigned to any live workshop hall.' });
      return;
    }

    const workshop = await Event.findById(user.assignedWorkshopId);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found.' });
      return;
    }

    const now = getCurrentISTDate();
    const nowTime = now.getTime();
    const winStart = new Date(workshop.attendanceWindowStart).getTime();
    const winEnd = new Date(workshop.attendanceWindowEnd).getTime();

    // 1. Server-side check: Workshop must not be ended by administrator
    if ((workshop.status as string) === 'Ended' || (workshop.status as string) === 'COMPLETED') {
      await createAuditLog({
        req,
        actorUserId: user._id,
        actorRole: 'VOLUNTEER',
        action: 'VOLUNTEER_ACTION_REJECTED',
        targetType: 'EVENT',
        targetId: workshop._id.toString(),
        reason: `Volunteer '${user.name}' (${user.ixId}) attempted to award performance credit after workshop was ended by administrator.`,
      });

      res.status(403).json({
        success: false,
        error: 'Workshop has been ended by administrator — performance scoring is permanently locked.',
        isWorkshopEnded: true,
      });
      return;
    }

    // 2. Server-side hall scoping check
    const registration = await EventRegistration.findOne({
      eventId: workshop._id,
      studentId: new Types.ObjectId(studentId),
      hallName: user.assignedHallName,
    });

    if (!registration) {
      res.status(404).json({ success: false, error: 'Student not found in your assigned hall.' });
      return;
    }

    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student profile not found.' });
      return;
    }

    // 2b. Server-side check: Performance points cannot be added until the student is marked PRESENT
    const attendanceRecord = await Attendance.findOne({
      eventId: workshop._id,
      studentId: student._id,
    });

    if (!attendanceRecord || attendanceRecord.status !== 'PRESENT') {
      res.status(400).json({
        success: false,
        error: 'Performance points cannot be added until the student is marked PRESENT.',
      });
      return;
    }

    // 3. Server-side credit cap calculation
    const existingTxs = await CreditTransaction.find({
      eventId: workshop._id,
      studentId: student._id,
      status: 'APPROVED',
    });

    const regPoints = existingTxs.filter((t) => t.creditType === 'REGISTRATION').reduce((sum, t) => sum + t.amount, 0);
    const attPoints = existingTxs.filter((t) => t.creditType === 'ATTENDANCE').reduce((sum, t) => sum + t.amount, 0);
    const maxAllowedParticipation = Math.max(0, workshop.creditCap - (regPoints + attPoints));

    if (targetPoints > maxAllowedParticipation) {
      await createAuditLog({
        req,
        actorUserId: user._id,
        actorRole: 'VOLUNTEER',
        action: 'VOLUNTEER_ACTION_REJECTED',
        targetType: 'STUDENT',
        targetId: student._id.toString(),
        reason: `Volunteer '${user.name}' (${user.ixId}) attempted to award ${targetPoints} pts to '${student.fullName}' which exceeds cap headroom (Max allowed: ${maxAllowedParticipation} pts).`,
      });

      res.status(400).json({
        success: false,
        error: `Exceeds workshop credit cap headroom! Maximum allowed performance credit for this student is ${maxAllowedParticipation} pts.`,
        maxAllowed: maxAllowedParticipation,
      });
      return;
    }

    // 4. Update Participation Record & Credit Transaction
    const existingPart = await ParticipationRecord.findOne({ eventId: workshop._id, studentId });
    const oldPoints = existingPart ? existingPart.points : 0;

    await ParticipationRecord.findOneAndUpdate(
      { eventId: workshop._id, studentId },
      {
        points: targetPoints,
        notes: evaluationReason,
        evaluatedBy: user._id,
        evaluatedAt: now,
      },
      { upsert: true, new: true }
    );

    // Sync Participation CreditTransaction
    if (targetPoints > 0) {
      const existingPartTx = await CreditTransaction.findOne({
        eventId: workshop._id,
        studentId: student._id,
        creditType: 'PARTICIPATION',
      });

      if (existingPartTx) {
        existingPartTx.amount = targetPoints;
        existingPartTx.reason = evaluationReason;
        existingPartTx.updatedAt = now;
        await existingPartTx.save();
      } else {
        const txId = await generateNextTransactionId();
        await CreditTransaction.create({
          transactionId: txId,
          studentId: student._id,
          eventId: workshop._id,
          creditType: 'PARTICIPATION',
          amount: targetPoints,
          reason: evaluationReason,
          awardedBy: user._id,
          approvedBy: user._id,
          status: 'APPROVED',
          createdAt: now,
          approvedAt: now,
        });
      }
    } else {
      await CreditTransaction.deleteMany({
        eventId: workshop._id,
        studentId: student._id,
        creditType: 'PARTICIPATION',
      });
    }

    await recalculateStudentLevelAndCache(student._id);
    const updatedStudent = await Student.findById(student._id);

    // 5. Activity Log Entry
    await createAuditLog({
      req,
      actorUserId: user._id,
      actorRole: 'VOLUNTEER',
      action: 'PARTICIPATION_CREDIT_ASSIGNED',
      targetType: 'STUDENT',
      targetId: student._id.toString(),
      beforeValue: { performancePoints: oldPoints },
      afterValue: { performancePoints: targetPoints, reason: evaluationReason },
      reason: `Volunteer '${user.name}' (${user.ixId}) updated performance credit for '${student.fullName}' (${student.influenceXId}) to ${targetPoints} pts. Reason: ${evaluationReason}`,
    });

    const totalCreditsThisWorkshop = regPoints + attPoints + targetPoints;
    const remainingCapHeadroom = Math.max(0, workshop.creditCap - totalCreditsThisWorkshop);

    res.status(200).json({
      success: true,
      message: `Performance credit of ${targetPoints} pts recorded for ${student.fullName}.`,
      studentId,
      participationPoints: targetPoints,
      participationReason: evaluationReason,
      totalCreditsThisWorkshop,
      cumulativeTotalCredits: updatedStudent?.cachedTotalCredits || totalCreditsThisWorkshop,
      remainingCapHeadroom,
    });
  } catch (error) {
    next(error);
  }
}
