import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Event } from '../models/Event';
import { Attendance } from '../models/Attendance';
import { ParticipationRecord } from '../models/ParticipationRecord';
import { createAuditLog } from '../utils/audit';
import { getCurrentISTDate } from '../utils/timezone';

const recordParticipationSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  participated: z.boolean().default(true),
  notes: z.string().optional().default(''),
});

export async function recordParticipation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { studentId, participated, notes } = recordParticipationSchema.parse(req.body);

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    // Prompt requirement: "Only recordable for students who already have an Attendance = PRESENT record for that event."
    const attendance = await Attendance.findOne({
      eventId: event._id,
      studentId: new Types.ObjectId(studentId),
    });

    if (!attendance || attendance.status !== 'PRESENT') {
      res.status(400).json({
        success: false,
        error: `Cannot record participation: Student is not marked as PRESENT for this event (Current status: ${attendance ? attendance.status : 'UNMARKED'}).`,
      });
      return;
    }

    const existingRecord = await ParticipationRecord.findOne({
      eventId: event._id,
      studentId: new Types.ObjectId(studentId),
    });

    let recordDoc;
    if (existingRecord) {
      const beforeValue = existingRecord.toJSON();
      existingRecord.participated = participated;
      existingRecord.notes = notes;
      existingRecord.recordedBy = req.user!._id;
      existingRecord.recordedAt = getCurrentISTDate();
      await existingRecord.save();
      recordDoc = existingRecord;

      await createAuditLog({
        req,
        action: 'PARTICIPATION_RECORD_UPDATED',
        targetType: 'PARTICIPATION_RECORD',
        targetId: existingRecord._id.toString(),
        beforeValue,
        afterValue: existingRecord.toJSON(),
        reason: `Participation set to ${participated ? 'YES' : 'NO'} for student in event ${event.eventId}`,
      });
    } else {
      recordDoc = await ParticipationRecord.create({
        eventId: event._id,
        studentId: new Types.ObjectId(studentId),
        participated,
        notes,
        recordedBy: req.user!._id,
        recordedAt: getCurrentISTDate(),
      });

      await createAuditLog({
        req,
        action: 'PARTICIPATION_RECORD_CREATED',
        targetType: 'PARTICIPATION_RECORD',
        targetId: recordDoc._id.toString(),
        afterValue: recordDoc.toJSON(),
        reason: `Participation recorded as ${participated ? 'YES' : 'NO'} for student in event ${event.eventId}`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Participation recorded as ${participated ? 'Participated' : 'Not Participated'}`,
      participation: recordDoc.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}
