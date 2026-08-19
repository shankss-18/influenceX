import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Event } from '../models/Event';
import { Student } from '../models/Student';
import { EventRegistration } from '../models/EventRegistration';
import { Attendance, AttendanceStatus } from '../models/Attendance';
import { ParticipationRecord } from '../models/ParticipationRecord';
import { CreditTransaction } from '../models/CreditTransaction';
import { generateNextTransactionId } from '../utils/sequence';
import { recalculateStudentLevelAndCache } from '../utils/ledger';
import { isWithinWindow, getEventWindowStatuses } from '../utils/window';
import { createAuditLog } from '../utils/audit';
import { getCurrentISTDate, dayjs, DEFAULT_TIMEZONE } from '../utils/timezone';

const markAttendanceSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  status: z.enum(['PRESENT', 'ABSENT', 'EXCUSED', 'LATE']),
});

const correctionRequestSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  requestedStatus: z.enum(['PRESENT', 'ABSENT', 'EXCUSED', 'LATE']),
  reason: z.string().min(5, 'A clear mandatory explanation is required for post-window corrections').trim(),
});

const approveCorrectionSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

export async function listEventAttendance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const now = getCurrentISTDate();

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    // 1. Fetch all registered students for this event
    const registrations = await EventRegistration.find({
      eventId: event._id,
      status: 'REGISTERED',
    })
      .populate('studentId')
      .sort({ registeredAt: 1 });

    const studentIds = registrations.map((r) => r.studentId._id);

    // 2. Fetch existing Attendance records
    const attendanceRecords = await Attendance.find({
      eventId: event._id,
      studentId: { $in: studentIds },
    }).populate('markedBy', 'name email').populate('requestedBy', 'name email').populate('approvedBy', 'name email');

    // 3. Fetch existing Participation records
    const participationRecords = await ParticipationRecord.find({
      eventId: event._id,
      studentId: { $in: studentIds },
    });

    const attendanceMap = new Map<string, any>();
    attendanceRecords.forEach((a) => attendanceMap.set(a.studentId.toString(), a.toJSON()));

    const participationMap = new Map<string, any>();
    participationRecords.forEach((p) => participationMap.set(p.studentId.toString(), p.toJSON()));

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let correctionPendingCount = 0;

    const roster = registrations.map((reg) => {
      const student = (reg.studentId as any).toJSON();
      const attendance = attendanceMap.get(student.id) || null;
      const participation = participationMap.get(student.id) || null;

      if (attendance) {
        if (attendance.status === 'PRESENT') presentCount++;
        else if (attendance.status === 'ABSENT') absentCount++;
        else if (attendance.status === 'LATE') lateCount++;
        else if (attendance.status === 'EXCUSED') excusedCount++;

        if (attendance.correctionStatus === 'PENDING_APPROVAL') {
          correctionPendingCount++;
        }
      }

      return {
        registrationId: reg._id.toString(),
        registeredAt: reg.registeredAt,
        student,
        attendance,
        participation,
      };
    });

    const windowStatuses = getEventWindowStatuses(event, now);
    const isAttendanceWindowOpen = windowStatuses.attendance.isOpen;

    res.status(200).json({
      success: true,
      event: {
        id: event._id.toString(),
        eventId: event.eventId,
        name: event.name,
        capacity: event.capacity,
        windowStatuses,
        isAttendanceWindowOpen,
      },
      stats: {
        totalRegistrants: roster.length,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        unmarkedCount: roster.length - (presentCount + absentCount + lateCount + excusedCount),
        correctionPendingCount,
      },
      roster,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAttendance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { studentId, status } = markAttendanceSchema.parse(req.body);
    const now = getCurrentISTDate();

    // 1. Find Event
    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    // 2. Validate Student Registration
    const isRegistered = await EventRegistration.exists({
      eventId: event._id,
      studentId: new Types.ObjectId(studentId),
      status: 'REGISTERED',
    });

    if (!isRegistered) {
      res.status(400).json({
        success: false,
        error: 'Cannot mark attendance: Student is not registered for this event.',
      });
      return;
    }

    // 3. Time-Window Enforcement
    const windowOpen = isWithinWindow(now, event.attendanceWindowStart, event.attendanceWindowEnd);
    if (!windowOpen) {
      res.status(400).json({
        success: false,
        error: `Attendance window is closed. Attendance may only be marked between ${dayjs(
          event.attendanceWindowStart
        )
          .tz(DEFAULT_TIMEZONE)
          .format('YYYY-MM-DD HH:mm:ss')} and ${dayjs(event.attendanceWindowEnd)
          .tz(DEFAULT_TIMEZONE)
          .format('YYYY-MM-DD HH:mm:ss')} IST. Submit a Correction Request instead.`,
        serverTime: now,
      });
      return;
    }

    // 4. Create or Update Attendance (using findOneAndUpdate for atomic upsert)
    const existing = await Attendance.findOne({
      eventId: event._id,
      studentId: new Types.ObjectId(studentId),
    });

    let attendanceDoc;
    if (existing) {
      const beforeValue = existing.toJSON();
      existing.status = status;
      existing.markedBy = req.user!._id;
      existing.markedAt = getCurrentISTDate();
      existing.lastUpdatedBy = req.user!._id;
      existing.lastUpdatedAt = getCurrentISTDate();
      existing.correctionStatus = 'NONE';
      existing.correctionReason = null;
      await existing.save();
      attendanceDoc = existing;

      await createAuditLog({
        req,
        action: 'ATTENDANCE_UPDATED',
        targetType: 'ATTENDANCE',
        targetId: existing._id.toString(),
        beforeValue,
        afterValue: existing.toJSON(),
        reason: `Attendance changed to ${status} for student in event ${event.eventId}`,
      });
    } else {
      attendanceDoc = await Attendance.create({
        eventId: event._id,
        studentId: new Types.ObjectId(studentId),
        status,
        markedBy: req.user!._id,
        markedAt: getCurrentISTDate(),
        correctionStatus: 'NONE',
        lastUpdatedBy: req.user!._id,
        lastUpdatedAt: getCurrentISTDate(),
      });

      await createAuditLog({
        req,
        action: 'ATTENDANCE_MARKED',
        targetType: 'ATTENDANCE',
        targetId: attendanceDoc._id.toString(),
        afterValue: attendanceDoc.toJSON(),
        reason: `Attendance marked ${status} for student in event ${event.eventId}`,
      });
    }

    // 5. Auto-Award 20 Credits for Physical Attendance when marked PRESENT
    if (status === 'PRESENT') {
      const sObjId = new Types.ObjectId(studentId);
      const existingAttTx = await CreditTransaction.findOne({
        studentId: sObjId,
        eventId: event._id,
        creditType: 'ATTENDANCE',
      });

      if (!existingAttTx) {
        const transactionId = await generateNextTransactionId();
        await CreditTransaction.create({
          transactionId,
          studentId: sObjId,
          eventId: event._id,
          creditType: 'ATTENDANCE',
          amount: 20,
          reason: `Verified physical attendance for workshop: ${event.name}`,
          awardedBy: req.user!._id,
          status: 'APPROVED',
          createdAt: getCurrentISTDate(),
          approvedAt: getCurrentISTDate(),
        });

        // Recalculate student tier & cache live
        await recalculateStudentLevelAndCache(sObjId);

        await createAuditLog({
          req,
          action: 'CREDIT_AUTO_AWARDED_ATTENDANCE',
          targetType: 'CREDIT_TRANSACTION',
          targetId: transactionId,
          reason: `Automatically awarded 20 attendance credits to student for event ${event.eventId}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Attendance recorded as ${status}${status === 'PRESENT' ? ' (+20 attendance credits added)' : ''}`,
      attendance: attendanceDoc.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function requestAttendanceCorrection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { studentId, requestedStatus, reason } = correctionRequestSchema.parse(req.body);

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    const isRegistered = await EventRegistration.exists({
      eventId: event._id,
      studentId: new Types.ObjectId(studentId),
      status: 'REGISTERED',
    });

    if (!isRegistered) {
      res.status(400).json({
        success: false,
        error: 'Cannot request correction: Student is not registered for this event.',
      });
      return;
    }

    let attendance = await Attendance.findOne({
      eventId: event._id,
      studentId: new Types.ObjectId(studentId),
    });

    const beforeValue = attendance ? attendance.toJSON() : null;

    if (attendance) {
      attendance.status = 'CORRECTION_REQUESTED';
      attendance.correctionStatus = 'PENDING_APPROVAL';
      attendance.requestedStatus = requestedStatus;
      attendance.correctionReason = reason;
      attendance.requestedBy = req.user!._id;
      attendance.lastUpdatedBy = req.user!._id;
      attendance.lastUpdatedAt = getCurrentISTDate();
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        eventId: event._id,
        studentId: new Types.ObjectId(studentId),
        status: 'CORRECTION_REQUESTED',
        markedBy: req.user!._id,
        markedAt: getCurrentISTDate(),
        correctionStatus: 'PENDING_APPROVAL',
        requestedStatus,
        correctionReason: reason,
        requestedBy: req.user!._id,
        lastUpdatedBy: req.user!._id,
        lastUpdatedAt: getCurrentISTDate(),
      });
    }

    await createAuditLog({
      req,
      action: 'ATTENDANCE_CORRECTION_REQUESTED',
      targetType: 'ATTENDANCE',
      targetId: attendance._id.toString(),
      beforeValue,
      afterValue: attendance.toJSON(),
      reason: `Correction to ${requestedStatus} requested: ${reason}`,
    });

    res.status(200).json({
      success: true,
      message: 'Correction request submitted for administrator review.',
      attendance: attendance.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function approveAttendanceCorrection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { attendanceId } = req.params;
    const { approved, notes } = approveCorrectionSchema.parse(req.body);

    const attendance = await Attendance.findById(attendanceId).populate('studentId', 'fullName influenceXId');
    if (!attendance) {
      res.status(404).json({ success: false, error: 'Attendance record not found' });
      return;
    }

    if (attendance.correctionStatus !== 'PENDING_APPROVAL') {
      res.status(400).json({
        success: false,
        error: 'This attendance record does not have a pending correction request.',
      });
      return;
    }

    const beforeValue = attendance.toJSON();

    if (approved) {
      attendance.status = attendance.requestedStatus || 'PRESENT';
      attendance.correctionStatus = 'APPROVED';
      attendance.approvedBy = req.user!._id;
      attendance.lastUpdatedBy = req.user!._id;
      attendance.lastUpdatedAt = getCurrentISTDate();
      await attendance.save();

      await createAuditLog({
        req,
        action: 'ATTENDANCE_CORRECTION_APPROVED',
        targetType: 'ATTENDANCE',
        targetId: attendance._id.toString(),
        beforeValue,
        afterValue: attendance.toJSON(),
        reason: `Approved attendance correction to ${attendance.status}. Admin note: ${notes || 'None'}`,
      });

      res.status(200).json({
        success: true,
        message: `Correction approved. Attendance status set to ${attendance.status}.`,
        attendance: attendance.toJSON(),
      });
    } else {
      attendance.status = 'ABSENT'; // Default back if rejected
      attendance.correctionStatus = 'REJECTED';
      attendance.approvedBy = req.user!._id;
      attendance.lastUpdatedBy = req.user!._id;
      attendance.lastUpdatedAt = getCurrentISTDate();
      await attendance.save();

      await createAuditLog({
        req,
        action: 'ATTENDANCE_CORRECTION_REJECTED',
        targetType: 'ATTENDANCE',
        targetId: attendance._id.toString(),
        beforeValue,
        afterValue: attendance.toJSON(),
        reason: `Rejected attendance correction request. Reason: ${notes || 'None'}`,
      });

      res.status(200).json({
        success: true,
        message: 'Correction request rejected.',
        attendance: attendance.toJSON(),
      });
    }
  } catch (error) {
    next(error);
  }
}
