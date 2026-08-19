import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Event, IEvent } from '../models/Event';
import { EventCategory } from '../models/EventCategory';
import { EventRegistration } from '../models/EventRegistration';
import { Student } from '../models/Student';
import { CreditTransaction } from '../models/CreditTransaction';
import { generateNextEventId, generateNextTransactionId } from '../utils/sequence';
import { isWithinWindow, getWindowStatus, getEventWindowStatuses } from '../utils/window';
import { createAuditLog } from '../utils/audit';
import { recalculateStudentLevelAndCache } from '../utils/ledger';
import { getCurrentISTDate, dayjs, DEFAULT_TIMEZONE } from '../utils/timezone';

const eventSchema = z.object({
  name: z.string().min(3).max(120).trim(),
  description: z.string().min(5).trim(),
  categoryId: z.string().min(1, 'Category is required'),
  date: z.string().or(z.date()),
  startTime: z.string().min(1).default('10:00 AM'),
  endTime: z.string().min(1).default('01:00 PM'),
  venue: z.string().min(2).max(100).trim(),
  hall: z.string().optional().default(''),
  capacity: z.number().min(1).default(50),
  assignedEventTeamUserIds: z.array(z.string()).optional().default([]),
  registrationStart: z.string().or(z.date()),
  registrationEnd: z.string().or(z.date()),
  attendanceWindowStart: z.string().or(z.date()),
  attendanceWindowEnd: z.string().or(z.date()),
  creditWindowStart: z.string().or(z.date()),
  creditWindowEnd: z.string().or(z.date()),
  interactionWindowStart: z.string().or(z.date()).optional(),
  interactionWindowEnd: z.string().or(z.date()).optional(),
  status: z.enum(['DRAFT', 'OPEN', 'ONGOING', 'COMPLETED', 'ARCHIVED']).optional().default('OPEN'),
});

export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    const query: any = {};
    const now = getCurrentISTDate();

    // Role-based visibility
    if (user?.role === 'STUDENT') {
      // Students see non-archived, non-draft events
      query.status = { $in: ['OPEN', 'ONGOING', 'COMPLETED'] };
    } else if (user?.role === 'EVENT_TEAM') {
      // Prompt requirement: "EVENT_TEAM can view assigned events only"
      query.$or = [
        { assignedEventTeamUserIds: user._id },
        { createdBy: user._id },
      ];
    }
    // ADMIN and FACULTY can view all events

    const categoryId = req.query.categoryId as string;
    const status = req.query.status as string;
    const search = (req.query.search as string || '').trim();

    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      query.categoryId = categoryId;
    }
    if (status && ['DRAFT', 'OPEN', 'ONGOING', 'COMPLETED', 'ARCHIVED'].includes(status)) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { eventId: { $regex: search, $options: 'i' } },
        { venue: { $regex: search, $options: 'i' } },
      ];
    }

    const events = await Event.find(query)
      .populate('categoryId', 'name description')
      .sort({ date: 1, createdAt: -1 });

    // Fetch registration counts for each event
    const eventIds = events.map((e) => e._id);
    const registrationCounts = await EventRegistration.aggregate([
      { $match: { eventId: { $in: eventIds }, status: 'REGISTERED' } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    registrationCounts.forEach((r) => countMap.set(r._id.toString(), r.count));

    // If student, check which events they are already registered for
    let userRegisteredEventIds = new Set<string>();
    if (user?.role === 'STUDENT') {
      const student = await Student.findOne({ userId: user._id });
      if (student) {
        const userRegistrations = await EventRegistration.find({
          studentId: student._id,
          status: 'REGISTERED',
        });
        userRegisteredEventIds = new Set(userRegistrations.map((r) => r.eventId.toString()));
      }
    }

    const enhancedEvents = events.map((e) => {
      const json = e.toJSON();
      const registeredCount = countMap.get(e._id.toString()) || 0;
      const windowStatuses = getEventWindowStatuses(e, now);
      const isUserRegistered = userRegisteredEventIds.has(e._id.toString());

      return {
        ...json,
        registeredCount,
        availableSpots: Math.max(0, e.capacity - registeredCount),
        isFull: registeredCount >= e.capacity,
        windowStatuses,
        isUserRegistered,
      };
    });

    res.status(200).json({
      success: true,
      count: enhancedEvents.length,
      serverTime: now,
      serverTimeIST: dayjs(now).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
      events: enhancedEvents,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEventById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const now = getCurrentISTDate();

    let query: any;
    if (Types.ObjectId.isValid(id)) {
      query = { $or: [{ _id: id }, { eventId: id }] };
    } else {
      query = { eventId: id };
    }

    const event = await Event.findOne(query)
      .populate('categoryId', 'name description')
      .populate('createdBy', 'name email role')
      .populate('assignedEventTeamUserIds', 'name email role');

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    const registeredCount = await EventRegistration.countDocuments({
      eventId: event._id,
      status: 'REGISTERED',
    });

    const windowStatuses = getEventWindowStatuses(event, now);

    let isUserRegistered = false;
    if (req.user?.role === 'STUDENT') {
      const student = await Student.findOne({ userId: req.user._id });
      if (student) {
        const existing = await EventRegistration.findOne({
          eventId: event._id,
          studentId: student._id,
          status: 'REGISTERED',
        });
        isUserRegistered = !!existing;
      }
    }

    res.status(200).json({
      success: true,
      event: {
        ...event.toJSON(),
        registeredCount,
        availableSpots: Math.max(0, event.capacity - registeredCount),
        isFull: registeredCount >= event.capacity,
        windowStatuses,
        isUserRegistered,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = eventSchema.parse(req.body);

    const category = await EventCategory.findById(data.categoryId);
    if (!category) {
      res.status(400).json({
        success: false,
        error: 'Invalid category specified',
      });
      return;
    }

    // 1. Generate atomic Event ID
    const eventId = await generateNextEventId();

    // 2. Parse dates into UTC Date objects
    const event = await Event.create({
      eventId,
      name: data.name,
      description: data.description,
      categoryId: new Types.ObjectId(data.categoryId),
      date: new Date(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      venue: data.venue,
      hall: data.hall || data.venue,
      capacity: data.capacity,
      assignedEventTeamUserIds: data.assignedEventTeamUserIds.map((id) => new Types.ObjectId(id)),
      registrationStart: new Date(data.registrationStart),
      registrationEnd: new Date(data.registrationEnd),
      attendanceWindowStart: new Date(data.attendanceWindowStart),
      attendanceWindowEnd: new Date(data.attendanceWindowEnd),
      creditWindowStart: new Date(data.creditWindowStart),
      creditWindowEnd: new Date(data.creditWindowEnd),
      interactionWindowStart: data.interactionWindowStart ? new Date(data.interactionWindowStart) : new Date(data.creditWindowStart),
      interactionWindowEnd: data.interactionWindowEnd ? new Date(data.interactionWindowEnd) : new Date(data.creditWindowEnd),
      status: data.status,
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
      createdAt: getCurrentISTDate(),
      updatedAt: getCurrentISTDate(),
    });

    // 3. Record AuditLog
    await createAuditLog({
      req,
      action: 'EVENT_CREATED',
      targetType: 'EVENT',
      targetId: event._id.toString(),
      afterValue: event.toJSON(),
      reason: `Event '${event.name}' (${eventId}) created by admin`,
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: event.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = eventSchema.partial().parse(req.body);

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    const beforeValue = event.toJSON();

    if (data.name) event.name = data.name;
    if (data.description) event.description = data.description;
    if (data.categoryId) event.categoryId = new Types.ObjectId(data.categoryId);
    if (data.date) event.date = new Date(data.date);
    if (data.startTime) event.startTime = data.startTime;
    if (data.endTime) event.endTime = data.endTime;
    if (data.venue) event.venue = data.venue;
    if (data.hall !== undefined) event.hall = data.hall;
    if (data.capacity) event.capacity = data.capacity;
    if (data.assignedEventTeamUserIds) {
      event.assignedEventTeamUserIds = data.assignedEventTeamUserIds.map((uId) => new Types.ObjectId(uId));
    }
    if (data.registrationStart) event.registrationStart = new Date(data.registrationStart);
    if (data.registrationEnd) event.registrationEnd = new Date(data.registrationEnd);
    if (data.attendanceWindowStart) event.attendanceWindowStart = new Date(data.attendanceWindowStart);
    if (data.attendanceWindowEnd) event.attendanceWindowEnd = new Date(data.attendanceWindowEnd);
    if (data.creditWindowStart) event.creditWindowStart = new Date(data.creditWindowStart);
    if (data.creditWindowEnd) event.creditWindowEnd = new Date(data.creditWindowEnd);
    if (data.interactionWindowStart) event.interactionWindowStart = new Date(data.interactionWindowStart);
    if (data.interactionWindowEnd) event.interactionWindowEnd = new Date(data.interactionWindowEnd);
    if (data.status) event.status = data.status;

    event.updatedBy = req.user!._id;
    event.updatedAt = getCurrentISTDate();
    await event.save();

    await createAuditLog({
      req,
      action: 'EVENT_UPDATED',
      targetType: 'EVENT',
      targetId: event._id.toString(),
      beforeValue,
      afterValue: event.toJSON(),
      reason: `Event '${event.name}' (${event.eventId}) updated by admin`,
    });

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      event: event.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function registerForEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const now = getCurrentISTDate();

    // 1. Fetch Event
    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    // 2. Check Event Status
    if (event.status !== 'OPEN') {
      res.status(400).json({
        success: false,
        error: `Cannot register: Event is currently ${event.status}. Registrations are only allowed for OPEN events.`,
      });
      return;
    }

    // 3. Strict Server-Side Time-Window Validation
    const windowState = getWindowStatus(now, event.registrationStart, event.registrationEnd);
    if (windowState === 'NOT_STARTED') {
      res.status(400).json({
        success: false,
        error: `Registration has not opened yet. Window opens on ${dayjs(event.registrationStart).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD HH:mm:ss')} IST.`,
        serverTime: now,
      });
      return;
    }
    if (windowState === 'CLOSED') {
      res.status(400).json({
        success: false,
        error: `Registration window closed on ${dayjs(event.registrationEnd).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD HH:mm:ss')} IST.`,
        serverTime: now,
      });
      return;
    }

    // 4. Determine Student ID
    let studentId: Types.ObjectId;
    let registeredBy: 'SELF' | 'ADMIN_IMPORT' = 'SELF';

    if (req.user?.role === 'STUDENT') {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student) {
        res.status(404).json({
          success: false,
          error: 'Student profile not found for authenticated account',
        });
        return;
      }
      if (student.status !== 'APPROVED') {
        res.status(403).json({
          success: false,
          error: `Registration forbidden: Your student account status is ${student.status}. Only APPROVED students may register.`,
        });
        return;
      }
      studentId = student._id;
    } else {
      // Admin registering a student
      const { studentId: reqStudentId } = req.body;
      if (!reqStudentId || !Types.ObjectId.isValid(reqStudentId)) {
        res.status(400).json({
          success: false,
          error: 'Please provide a valid studentId for admin registration',
        });
        return;
      }
      studentId = new Types.ObjectId(reqStudentId);
      registeredBy = 'ADMIN_IMPORT';
    }

    // 5. Check Capacity
    const currentRegistrants = await EventRegistration.countDocuments({
      eventId: event._id,
      status: 'REGISTERED',
    });

    if (currentRegistrants >= event.capacity) {
      res.status(400).json({
        success: false,
        error: `Cannot register: Event capacity limit (${event.capacity}) has been reached.`,
      });
      return;
    }

    // 6. Check Duplicate Registration
    const existingRegistration = await EventRegistration.findOne({
      eventId: event._id,
      studentId,
    });

    if (existingRegistration) {
      if (existingRegistration.status === 'REGISTERED') {
        res.status(409).json({
          success: false,
          error: 'Student is already registered for this event',
        });
        return;
      } else {
        // Re-activate registration
        existingRegistration.status = 'REGISTERED';
        existingRegistration.registeredAt = getCurrentISTDate();
        await existingRegistration.save();

        await createAuditLog({
          req,
          action: 'EVENT_REGISTRATION_RENEWED',
          targetType: 'EVENT_REGISTRATION',
          targetId: existingRegistration._id.toString(),
          reason: `Registration re-activated for event ${event.eventId}`,
        });

        res.status(200).json({
          success: true,
          message: 'Successfully registered for event',
          registration: existingRegistration.toJSON(),
        });
        return;
      }
    }

    // 7. Create New Registration
    const registration = await EventRegistration.create({
      eventId: event._id,
      studentId,
      registeredAt: getCurrentISTDate(),
      registeredBy,
      status: 'REGISTERED',
    });

    // 8. Auto-Award Default 10 Credits for Registration (Digital Ledger Record)
    const existingRegTx = await CreditTransaction.findOne({
      studentId,
      eventId: event._id,
      creditType: 'REGISTRATION',
    });

    if (!existingRegTx) {
      const transactionId = await generateNextTransactionId();
      await CreditTransaction.create({
        transactionId,
        studentId,
        eventId: event._id,
        creditType: 'REGISTRATION',
        amount: 10,
        reason: `Default registration credit for workshop: ${event.name}`,
        awardedBy: req.user!._id,
        status: 'APPROVED',
        createdAt: getCurrentISTDate(),
        approvedAt: getCurrentISTDate(),
      });

      // Recalculate student tier & cache live
      await recalculateStudentLevelAndCache(studentId);

      await createAuditLog({
        req,
        action: 'CREDIT_AUTO_AWARDED_REGISTRATION',
        targetType: 'CREDIT_TRANSACTION',
        targetId: transactionId,
        reason: `Automatically awarded 10 registration credits to student for event ${event.eventId}`,
      });
    }

    // 9. Record AuditLog
    await createAuditLog({
      req,
      action: 'EVENT_REGISTRATION_CREATED',
      targetType: 'EVENT_REGISTRATION',
      targetId: registration._id.toString(),
      afterValue: {
        eventId: event.eventId,
        eventName: event.name,
        studentId: studentId.toString(),
        registeredBy,
      },
      reason: `Student registered for event '${event.name}' (${event.eventId})`,
    });

    res.status(201).json({
      success: true,
      message: 'Successfully registered for event (+10 registration credits added)',
      registration: registration.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function listEventRegistrations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const registrations = await EventRegistration.find({ eventId: id })
      .populate({
        path: 'studentId',
        select: 'influenceXId collegeStudentId fullName collegeEmail branch year section status',
      })
      .sort({ registeredAt: 1 });

    res.status(200).json({
      success: true,
      count: registrations.length,
      registrations: registrations.map((r) => r.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}
