import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { Event, IEvent, computeWorkshopLifecycleStatus } from '../models/Event';
import { EventRegistration } from '../models/EventRegistration';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { ParticipationRecord } from '../models/ParticipationRecord';
import { CreditTransaction } from '../models/CreditTransaction';
import { AuditLog } from '../models/AuditLog';
import { generateNextEventId, generateNextTransactionId, generateNextTransactionIdBlock } from '../utils/sequence';
import { hashPassword } from '../utils/jwt';
import { recalculateStudentLevelAndCache } from '../utils/ledger';
import { createAuditLog } from '../utils/audit';
import { parseExcelUpload, exportToExcel } from '../utils/excel';
import { getCurrentISTDate, isWithinWindow, dayjs, DEFAULT_TIMEZONE } from '../utils/timezone';

// Validation Schemas
const createWorkshopSchema = z.object({
  name: z.string().min(3, 'Workshop name must be at least 3 characters'),
  description: z.string().min(5, 'Workshop description is required'),
  date: z.string().min(1, 'Workshop date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  halls: z
    .array(
      z.object({
        name: z.string().min(1, 'Hall name is required'),
        capacity: z.number().int().min(1, 'Capacity must be at least 1'),
      })
    )
    .min(1, 'At least 1 hall is required'),
  attendanceWindowStart: z.string().min(1, 'Window start datetime is required'),
  attendanceWindowEnd: z.string().min(1, 'Window end datetime is required'),
  creditCap: z.number().int().min(1).default(50),
  registrationFormUrl: z.string().optional().default(''),
});

/**
 * Screen 1 — List all workshops with flat table metrics
 */
export async function listWorkshops(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    const now = getCurrentISTDate();

    const workshopRows = await Promise.all(
      events.map(async (event) => {
        const computedStatus = computeWorkshopLifecycleStatus(event, now);

        // Compute capacity & students assigned
        const totalCapacity = event.halls && event.halls.length > 0
          ? event.halls.reduce((sum, h) => sum + (h.capacity || 0), 0)
          : event.capacity || 0;

        const studentsAssigned = await EventRegistration.countDocuments({
          eventId: event._id,
          status: 'REGISTERED',
        });

        // Compute volunteers assigned vs needed (each hall needs 2-3)
        const hallsCount = event.halls?.length || 1;
        const totalVolunteersAssigned = event.halls?.reduce(
          (sum, h) => sum + (h.assignedVolunteers?.length || 0),
          0
        ) || 0;
        const minVolunteersNeeded = hallsCount * 2;
        const maxVolunteersNeeded = hallsCount * 3;

        // Compute credits issued so far for this workshop
        const creditAgg = await CreditTransaction.aggregate([
          { $match: { eventId: event._id, status: 'APPROVED' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const creditsIssuedSoFar = creditAgg.length > 0 ? creditAgg[0].total : 0;

        return {
          id: event._id.toString(),
          eventId: event.eventId,
          name: event.name,
          description: event.description,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          venue: event.venue,
          status: computedStatus,
          rawStatus: event.status,
          hallsCount,
          halls: event.halls || [],
          totalCapacity,
          studentsAssigned,
          volunteersAssigned: totalVolunteersAssigned,
          minVolunteersNeeded,
          maxVolunteersNeeded,
          volunteersSetupCompleted: event.volunteersSetupCompleted,
          studentsSetupCompleted: event.studentsSetupCompleted,
          creditCap: event.creditCap || 50,
          creditsIssuedSoFar,
          attendanceWindowStart: event.attendanceWindowStart,
          attendanceWindowEnd: event.attendanceWindowEnd,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: workshopRows.length,
      workshops: workshopRows,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 2 — Create Workshop
 */
export async function createWorkshop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createWorkshopSchema.parse(req.body);
    const now = getCurrentISTDate();

    // Verify window bounds
    const winStart = new Date(data.attendanceWindowStart);
    const winEnd = new Date(data.attendanceWindowEnd);
    if (winEnd.getTime() <= winStart.getTime()) {
      res.status(400).json({
        success: false,
        error: 'Attendance window end time must be strictly after the start time.',
      });
      return;
    }

    const eventId = await generateNextEventId();
    const totalCapacity = data.halls.reduce((sum, h) => sum + h.capacity, 0);

    const workshop = await Event.create({
      eventId,
      name: data.name,
      description: data.description,
      date: new Date(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      venue: data.halls.map((h) => h.name).join(', '),
      halls: data.halls.map((h) => ({
        name: h.name,
        capacity: h.capacity,
        assignedVolunteers: [],
      })),
      capacity: totalCapacity,
      creditCap: data.creditCap || 50,
      registrationFormUrl: data.registrationFormUrl || '',
      registrationStart: winStart,
      registrationEnd: winEnd,
      attendanceWindowStart: winStart,
      attendanceWindowEnd: winEnd,
      creditWindowStart: winStart,
      creditWindowEnd: winEnd,
      volunteersSetupCompleted: false,
      studentsSetupCompleted: false,
      status: 'Live',
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog({
      req,
      action: 'EVENT_CREATED',
      targetType: 'EVENT',
      targetId: workshop._id.toString(),
      afterValue: workshop.toJSON(),
      reason: `Admin created new workshop '${workshop.name}' (${workshop.eventId}) with ${data.halls.length} halls (Total capacity: ${totalCapacity})`,
    });

    res.status(201).json({
      success: true,
      message: `Workshop '${workshop.name}' created successfully. Redirecting to Setup.`,
      workshop: workshop.toJSON(),
      nextStepUrl: `/admin/workshops/${workshop._id}/setup`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin Edits Workshop Details At Every Stage
 */
export async function updateWorkshop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      date,
      startTime,
      endTime,
      halls,
      attendanceWindowStart,
      attendanceWindowEnd,
      creditCap,
      registrationFormUrl,
    } = req.body as {
      name?: string;
      description?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      halls?: Array<{ name: string; capacity: number }>;
      attendanceWindowStart?: string;
      attendanceWindowEnd?: string;
      creditCap?: number;
      registrationFormUrl?: string;
    };

    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    const beforeValue = workshop.toJSON();
    const now = getCurrentISTDate();

    if (name !== undefined) workshop.name = name;
    if (description !== undefined) workshop.description = description;
    if (date !== undefined) workshop.date = new Date(date);
    if (startTime !== undefined) workshop.startTime = startTime;
    if (endTime !== undefined) workshop.endTime = endTime;
    if (creditCap !== undefined) workshop.creditCap = Number(creditCap);
    if (registrationFormUrl !== undefined) workshop.registrationFormUrl = registrationFormUrl.trim();

    if (attendanceWindowStart) {
      const winStart = new Date(attendanceWindowStart);
      workshop.attendanceWindowStart = winStart;
      workshop.registrationStart = winStart;
      workshop.creditWindowStart = winStart;
    }
    if (attendanceWindowEnd) {
      const winEnd = new Date(attendanceWindowEnd);
      workshop.attendanceWindowEnd = winEnd;
      workshop.registrationEnd = winEnd;
      workshop.creditWindowEnd = winEnd;
    }

    if (halls && halls.length > 0) {
      const existingVolMap = new Map<string, any[]>();
      workshop.halls.forEach((h) => {
        if (h.assignedVolunteers && h.assignedVolunteers.length > 0) {
          existingVolMap.set(h.name, h.assignedVolunteers);
        }
      });

      workshop.halls = halls.map((h) => ({
        name: h.name,
        capacity: Number(h.capacity),
        assignedVolunteers: existingVolMap.get(h.name) || [],
      }));

      const totalCap = halls.reduce((sum, h) => sum + Number(h.capacity), 0);
      workshop.capacity = totalCap;
      workshop.venue = halls.map((h) => h.name).join(', ');
    }

    workshop.updatedBy = req.user!._id;
    workshop.updatedAt = now;
    await workshop.save();

    await createAuditLog({
      req,
      action: 'EVENT_UPDATED',
      targetType: 'EVENT',
      targetId: workshop._id.toString(),
      beforeValue,
      afterValue: workshop.toJSON(),
      reason: `Admin updated details of workshop '${workshop.name}' (${workshop.eventId})`,
    });

    res.status(200).json({
      success: true,
      message: `Workshop '${workshop.name}' details successfully updated.`,
      workshop: workshop.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin Deletes Workshop At Every Stage
 */
export async function deleteWorkshop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const workshop = await Event.findById(id);

    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    const beforeValue = workshop.toJSON();

    // 1. Delete all event registrations for this workshop
    await EventRegistration.deleteMany({ eventId: workshop._id });

    // 2. Unlink volunteers assigned to this workshop
    await User.updateMany(
      { assignedWorkshopId: workshop._id },
      { $unset: { assignedWorkshopId: '', assignedHallName: '' } }
    );

    // 3. Delete the workshop event
    await Event.findByIdAndDelete(workshop._id);

    await createAuditLog({
      req,
      action: 'EVENT_DELETED',
      targetType: 'EVENT',
      targetId: id,
      beforeValue,
      reason: `Admin deleted workshop '${workshop.name}' (${workshop.eventId}) and unlinked all volunteers/registrations`,
    });

    res.status(200).json({
      success: true,
      message: `Workshop '${workshop.name}' (${workshop.eventId}) has been deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 3 — Get Workshop Setup Details
 */
export async function getWorkshopSetupData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    const registrations = await EventRegistration.find({ eventId: workshop._id })
      .populate('studentId', 'fullName influenceXId collegeStudentId branch year collegeEmail')
      .sort({ assignedOrder: 1 });

    const totalAssignedStudents = registrations.filter((r) => r.status === 'REGISTERED').length;
    const totalWaitlisted = registrations.filter((r) => r.status === 'WAITLISTED').length;

    const computedStatus = computeWorkshopLifecycleStatus(workshop);

    res.status(200).json({
      success: true,
      workshop: {
        ...workshop.toJSON(),
        computedStatus,
      },
      halls: workshop.halls || [],
      volunteersSetupCompleted: workshop.volunteersSetupCompleted,
      studentsSetupCompleted: workshop.studentsSetupCompleted,
      totalCapacity: workshop.halls?.reduce((sum, h) => sum + h.capacity, 0) || workshop.capacity,
      totalAssignedStudents,
      totalWaitlisted,
      placedStudents: registrations.map((r: any) => ({
        id: r._id,
        studentId: r.studentId?._id,
        fullName: r.studentId?.fullName,
        influenceXId: r.studentId?.influenceXId,
        collegeStudentId: r.studentId?.collegeStudentId,
        collegeEmail: r.studentId?.collegeEmail,
        branch: r.studentId?.branch,
        year: r.studentId?.year,
        hallName: r.hallName,
        assignedOrder: r.assignedOrder,
        status: r.status,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 3a — Step 1: Upload Volunteers Spreadsheet
 */
export async function previewVolunteersUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: 'Please upload an Excel spreadsheet (.xlsx)' });
      return;
    }

    const workshop = await Event.findById(id);
    if (!workshop) {
      fs.unlinkSync(file.path);
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    const parsedRows = await parseExcelUpload(file.path);
    fs.unlinkSync(file.path); // Clean temp file

    const validatedVolunteers: Array<{
      rowNumber: number;
      name: string;
      niatId: string;
      ixId: string;
      workshopName: string;
      isValid: boolean;
      issue?: string;
    }> = [];

    const seenIxIds = new Set<string>();

    for (const row of parsedRows) {
      const name = (row.fullName || row.rawData['name'] || '').trim();
      const niatId = (row.collegeStudentId || row.rawData['niat id'] || row.rawData['niatid'] || '').trim();
      const ixId = (row.influenceXId || row.rawData['ixid'] || row.rawData['ix_id'] || '').trim().toUpperCase();
      const rawWorkshopName = (row.rawData['workshop name'] || row.rawData['workshop'] || '').trim();

      if (!name || !ixId) {
        validatedVolunteers.push({
          rowNumber: row.rowNumber,
          name,
          niatId,
          ixId,
          workshopName: rawWorkshopName,
          isValid: false,
          issue: 'Missing Name or IXID',
        });
        continue;
      }

      const isValidIxFormat = /^IX-?\w+$/i.test(ixId) && ixId.length >= 4;
      if (!isValidIxFormat) {
        validatedVolunteers.push({
          rowNumber: row.rowNumber,
          name,
          niatId,
          ixId,
          workshopName: rawWorkshopName,
          isValid: false,
          issue: "Invalid IXID format (expected 'IX****' e.g. IX0451)",
        });
        continue;
      }

      if (
        rawWorkshopName &&
        !workshop.name.toLowerCase().includes(rawWorkshopName.toLowerCase()) &&
        !rawWorkshopName.toLowerCase().includes(workshop.name.toLowerCase()) &&
        !workshop.eventId.toLowerCase().includes(rawWorkshopName.toLowerCase())
      ) {
        validatedVolunteers.push({
          rowNumber: row.rowNumber,
          name,
          niatId,
          ixId,
          workshopName: rawWorkshopName,
          isValid: false,
          issue: `Workshop name mismatch: File specifies '${rawWorkshopName}', current workshop is '${workshop.name}'`,
        });
        continue;
      }

      if (seenIxIds.has(ixId)) {
        validatedVolunteers.push({
          rowNumber: row.rowNumber,
          name,
          niatId,
          ixId,
          workshopName: rawWorkshopName,
          isValid: false,
          issue: `Duplicate IXID '${ixId}' in uploaded file`,
        });
        continue;
      }

      seenIxIds.add(ixId);

      validatedVolunteers.push({
        rowNumber: row.rowNumber,
        name,
        niatId,
        ixId,
        workshopName: rawWorkshopName || workshop.name,
        isValid: true,
      });
    }

    const validCount = validatedVolunteers.filter((v) => v.isValid).length;

    res.status(200).json({
      success: true,
      totalRows: parsedRows.length,
      validCount,
      issueCount: parsedRows.length - validCount,
      volunteers: validatedVolunteers,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 3a — Step 2: Assign Volunteers to Halls & Verify 2-3 Rule
 */
export async function assignVolunteersToHalls(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { assignments } = req.body as {
      assignments: Array<{ name: string; ixId: string; niatId?: string; hallName: string }>;
    };

    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    if (!workshop.halls || workshop.halls.length === 0) {
      res.status(400).json({ success: false, error: 'Workshop has no halls configured.' });
      return;
    }

    // Group by hall
    const hallMap = new Map<string, Array<{ name: string; ixId: string; niatId?: string }>>();
    workshop.halls.forEach((h) => hallMap.set(h.name, []));

    const seenIxIds = new Set<string>();

    for (const a of assignments) {
      if (!a.hallName || !hallMap.has(a.hallName)) {
        res.status(400).json({ success: false, error: `Invalid hall '${a.hallName}' assigned to volunteer ${a.name}` });
        return;
      }
      if (seenIxIds.has(a.ixId)) {
        res.status(400).json({ success: false, error: `Duplicate volunteer '${a.name}' (${a.ixId}) assigned multiple times.` });
        return;
      }
      seenIxIds.add(a.ixId);
      hallMap.get(a.hallName)!.push({ name: a.name, ixId: a.ixId, niatId: a.niatId });
    }

    // Save hall volunteer staffing (any number of volunteers allowed)
    workshop.halls.forEach((hall) => {
      const assigned = hallMap.get(hall.name) || [];
      hall.assignedVolunteers = assigned.map((v) => ({
        userId: new Types.ObjectId(), // Will be updated on credential generation
        name: v.name,
        ixId: v.ixId,
        niatId: v.niatId || '',
        assignedAt: getCurrentISTDate(),
      }));
    });

    workshop.volunteersSetupCompleted = true;
    await workshop.save();

    // Sync live User assignedHallName for all existing volunteer accounts
    for (const a of assignments) {
      await User.findOneAndUpdate(
        { ixId: a.ixId },
        { assignedHallName: a.hallName, assignedWorkshopId: workshop._id }
      );
    }

    res.status(200).json({
      success: true,
      message: `Volunteers successfully assigned across halls. Ready for credential generation or live updates.`,
      halls: workshop.halls,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 3a — Step 3: Generate Volunteer Temporary Credentials & One-Time Reveal Sheet
 */
export async function generateVolunteerCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    if (!workshop.volunteersSetupCompleted) {
      res.status(400).json({ success: false, error: 'Assign 2-3 volunteers to all halls before generating credentials.' });
      return;
    }

    const now = getCurrentISTDate();
    const oneTimeCredentialsList: Array<{
      name: string;
      ixId: string;
      niatId: string;
      hallName: string;
      username: string;
      tempPassword: string;
    }> = [];

    for (const hall of workshop.halls) {
      if (!hall.assignedVolunteers || hall.assignedVolunteers.length === 0) continue;

      for (const vol of hall.assignedVolunteers) {
        const tempPassword = `Vol#${crypto.randomInt(1000, 9999)}`;
        const passwordHash = await hashPassword(tempPassword);
        const username = vol.ixId.toLowerCase();
        const email = `${username}@influencex.niat.edu`;

        const user = await User.findOneAndUpdate(
          { ixId: vol.ixId },
          {
            name: vol.name,
            email,
            passwordHash,
            role: 'VOLUNTEER',
            status: 'ACTIVE',
            ixId: vol.ixId,
            niatId: vol.niatId || '',
            assignedWorkshopId: workshop._id,
            assignedHallName: hall.name,
            mustChangePassword: true,
            createdAt: now,
          },
          { upsert: true, new: true }
        );

        vol.userId = user._id;

        oneTimeCredentialsList.push({
          name: vol.name,
          ixId: vol.ixId,
          niatId: vol.niatId || '',
          hallName: hall.name,
          username: vol.ixId,
          tempPassword,
        });

        // Audit log (never log plain password)
        await createAuditLog({
          req,
          action: 'USER_CREATED',
          targetType: 'USER',
          targetId: user._id.toString(),
          reason: `Generated temporary login credentials for volunteer ${vol.name} (${vol.ixId}) for hall '${hall.name}' in workshop '${workshop.name}'`,
        });
      }
    }

    workshop.credentialsGeneratedAt = now;
    await workshop.save();

    res.status(200).json({
      success: true,
      message: `Generated temporary credentials for ${oneTimeCredentialsList.length} volunteers. Plaintext credentials are revealed ONCE only.`,
      credentials: oneTimeCredentialsList,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 3b — Step 1 & 2: Students Excel Upload & Auto-Assignment Algorithm
 */
export async function previewStudentsAutoAssign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: 'Please upload an Excel spreadsheet (.xlsx)' });
      return;
    }

    const workshop = await Event.findById(id);
    if (!workshop) {
      fs.unlinkSync(file.path);
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    const parsedRows = await parseExcelUpload(file.path);
    fs.unlinkSync(file.path);

    if (!workshop.halls || workshop.halls.length === 0) {
      res.status(400).json({ success: false, error: 'No halls found in this workshop.' });
      return;
    }

    const totalCapacity = workshop.halls.reduce((sum, h) => sum + h.capacity, 0);

    // Auto-assignment algorithm: Preserves row order
    // Fill Hall 1 up to capacity, then Hall 2 up to capacity, etc.
    // Strictly adhere to total workshop capacity (take first N rows up to total capacity, avoid remaining)
    const assignedStudents: Array<{
      assignedOrder: number;
      name: string;
      ixId: string;
      niatId: string;
      collegeEmail: string;
      hallName: string;
      isWaitlisted: boolean;
    }> = [];

    let currentHallIndex = 0;
    let currentHallCount = 0;

    const rowsToProcess = parsedRows.slice(0, totalCapacity);

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      const name = (
        row.fullName ||
        row.rawData['name'] ||
        row.rawData['student name'] ||
        row.rawData['participant name'] ||
        row.rawData['full name'] ||
        `Student #${row.rowNumber}`
      ).trim();

      const ixId = (
        row.influenceXId ||
        row.rawData['ixid'] ||
        row.rawData['ix id'] ||
        row.rawData['ix_id'] ||
        `IX${String(i + 1).padStart(4, '0')}`
      ).trim().toUpperCase();

      const niatId = (
        row.collegeStudentId ||
        row.rawData['niat id'] ||
        row.rawData['niatid'] ||
        row.rawData['niat'] ||
        row.rawData['roll no'] ||
        row.rawData['roll'] ||
        row.rawData['college id'] ||
        `N25H01A${String(i + 1).padStart(4, '0')}`
      ).trim();

      const collegeEmail = (
        row.collegeEmail ||
        row.rawData['email'] ||
        row.rawData['college email'] ||
        `${ixId.toLowerCase()}@influencex.niat.edu`
      ).trim().toLowerCase();

      if (currentHallIndex < workshop.halls.length) {
        const currentHall = workshop.halls[currentHallIndex];

        assignedStudents.push({
          assignedOrder: i + 1,
          name,
          ixId,
          niatId,
          collegeEmail,
          hallName: currentHall.name,
          isWaitlisted: false,
        });

        currentHallCount++;
        if (currentHallCount >= currentHall.capacity) {
          currentHallIndex++;
          currentHallCount = 0;
        }
      }
    }

    const ignoredOverflowCount = Math.max(0, parsedRows.length - totalCapacity);
    const placedCount = assignedStudents.length;

    res.status(200).json({
      success: true,
      totalUploaded: parsedRows.length,
      totalCapacity,
      placedCount,
      overflowCount: 0,
      ignoredOverflowCount,
      hasOverflow: ignoredOverflowCount > 0,
      message:
        ignoredOverflowCount > 0
          ? `Accepted first ${placedCount} students (strictly capped to workshop capacity ${totalCapacity}). ${ignoredOverflowCount} extra row(s) were avoided.`
          : `All ${placedCount} students accepted and placed into halls sequentially.`,
      hallBreakdown: workshop.halls.map((h) => ({
        hallName: h.name,
        capacity: h.capacity,
        assignedCount: assignedStudents.filter((s) => s.hallName === h.name).length,
      })),
      assignedRoster: assignedStudents,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Purge All Existing Workshops (Clean Slate)
 */
export async function purgeAllWorkshops(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workshops = await Event.find({});
    const workshopIds = workshops.map((w) => w._id);

    await Event.deleteMany({});
    await EventRegistration.deleteMany({ eventId: { $in: workshopIds } });
    await Attendance.deleteMany({ eventId: { $in: workshopIds } });
    await ParticipationRecord.deleteMany({ eventId: { $in: workshopIds } });
    await CreditTransaction.updateMany({ eventId: { $in: workshopIds } }, { status: 'REJECTED' });
    await User.updateMany(
      { role: 'VOLUNTEER' },
      { $unset: { assignedWorkshopId: 1, assignedHallName: 1 } }
    );

    res.status(200).json({
      success: true,
      message: `Successfully deleted all ${workshops.length} existing workshop(s) and cleared allocations.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 3b — Commit Students Placement & Auto-Award +10 Default Credits
 */
export async function commitStudentsPlacement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { roster } = req.body as {
      roster: Array<{
        name: string;
        ixId: string;
        niatId?: string;
        collegeEmail?: string;
        hallName: string;
        assignedOrder: number;
        isWaitlisted: boolean;
      }>;
    };

    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    const now = getCurrentISTDate();
    let importedCount = 0;
    let newlyCreditedCount = 0;

    // 1. Precompute password hash ONCE for all new student accounts
    const defaultPasswordHash = await hashPassword('Student@123456');

    // 2. Pre-fetch all existing students and users matching this roster
    const ixIds = roster.map((r) => r.ixId).filter(Boolean);
    const niatIds = roster.map((r) => r.niatId).filter(Boolean);
    const emails = roster.map((r) => (r.collegeEmail || `${r.ixId.toLowerCase()}@influencex.niat.edu`).toLowerCase());

    const [existingStudents, existingUsers] = await Promise.all([
      Student.find({
        $or: [
          { influenceXId: { $in: ixIds } },
          { collegeStudentId: { $in: niatIds } },
        ],
      }),
      User.find({ email: { $in: emails } }),
    ]);

    const studentByIxId = new Map<string, any>();
    const studentByNiatId = new Map<string, any>();
    existingStudents.forEach((s) => {
      if (s.influenceXId) studentByIxId.set(s.influenceXId.toUpperCase(), s);
      if (s.collegeStudentId) studentByNiatId.set(s.collegeStudentId.toUpperCase(), s);
    });

    const userByEmail = new Map<string, any>();
    existingUsers.forEach((u) => userByEmail.set(u.email.toLowerCase(), u));

    // 3. Pre-create any missing User and Student records in batch
    const missingUsers: any[] = [];
    const missingStudentsData: any[] = [];

    for (const item of roster) {
      const ixKey = item.ixId.toUpperCase();
      const niatKey = (item.niatId || '').toUpperCase();
      const email = (item.collegeEmail || `${item.ixId.toLowerCase()}@influencex.niat.edu`).toLowerCase();

      let student = studentByIxId.get(ixKey) || (niatKey ? studentByNiatId.get(niatKey) : null);
      if (!student) {
        let user = userByEmail.get(email);
        if (!user) {
          const studentDefaultHash = await hashPassword(ixKey);
          user = {
            _id: new Types.ObjectId(),
            name: item.name,
            email,
            ixId: ixKey,
            passwordHash: studentDefaultHash,
            role: 'STUDENT',
            status: 'ACTIVE',
            mustChangePassword: true,
            createdAt: now,
          };
          userByEmail.set(email, user);
          missingUsers.push(user);
        }

        const newStudent = {
          _id: new Types.ObjectId(),
          userId: user._id,
          influenceXId: item.ixId,
          collegeStudentId: item.niatId || `NIAT-${item.ixId}`,
          fullName: item.name,
          collegeEmail: email,
          branch: 'General Engineering',
          year: 2,
          section: 'A',
          status: 'APPROVED',
          cachedTotalCredits: 0,
          currentLevel: 'Explorer',
          joiningDate: now,
          createdAt: now,
          updatedAt: now,
        };
        studentByIxId.set(ixKey, newStudent);
        if (niatKey) studentByNiatId.set(niatKey, newStudent);
        missingStudentsData.push(newStudent);
      } else {
        // Update existing student and user name / IXID for strict matching
        if (student.fullName !== item.name || student.influenceXId !== item.ixId) {
          await Student.updateOne(
            { _id: student._id },
            { fullName: item.name, influenceXId: item.ixId }
          );
        }
        if (student.userId) {
          const defaultHash = await hashPassword(item.ixId);
          await User.updateOne(
            { _id: student.userId },
            { name: item.name, ixId: item.ixId, passwordHash: defaultHash }
          );
        }
      }
    }

    if (missingUsers.length > 0) {
      await User.insertMany(missingUsers, { ordered: false });
    }
    if (missingStudentsData.length > 0) {
      await Student.insertMany(missingStudentsData, { ordered: false });
    }

    // 4. Pre-fetch existing registration credits for this workshop
    const existingRegTxs = await CreditTransaction.find({
      eventId: workshop._id,
      creditType: 'REGISTRATION',
    }).select('studentId');
    const alreadyCreditedStudentIds = new Set(
      existingRegTxs.map((t) => t.studentId.toString())
    );

    const registrationOps: any[] = [];
    const studentsToCredit: Array<{ student: any; hallName: string }> = [];

    for (const item of roster) {
      const ixKey = item.ixId.toUpperCase();
      const niatKey = (item.niatId || '').toUpperCase();
      const student = studentByIxId.get(ixKey) || (niatKey ? studentByNiatId.get(niatKey) : null);
      if (!student) continue;

      registrationOps.push({
        updateOne: {
          filter: { eventId: workshop._id, studentId: student._id },
          update: {
            $set: {
              hallName: item.hallName,
              assignedOrder: item.assignedOrder,
              isWaitlisted: item.isWaitlisted,
              registeredBy: 'WORKSHOP_AUTO_ASSIGN',
              registeredAt: now,
              status: item.isWaitlisted ? 'WAITLISTED' : 'REGISTERED',
            },
          },
          upsert: true,
        },
      });

      const sIdStr = student._id.toString();
      if (!item.isWaitlisted && !alreadyCreditedStudentIds.has(sIdStr)) {
        studentsToCredit.push({ student, hallName: item.hallName });
        alreadyCreditedStudentIds.add(sIdStr);
      }

      importedCount++;
    }

    // Execute bulk registration updates
    if (registrationOps.length > 0) {
      await EventRegistration.bulkWrite(registrationOps);
    }

    // Batch create registration credit transactions
    if (studentsToCredit.length > 0) {
      const txIds = await generateNextTransactionIdBlock(studentsToCredit.length);
      const txDocs = studentsToCredit.map((sc, idx) => ({
        transactionId: txIds[idx],
        studentId: sc.student._id,
        eventId: workshop._id,
        creditType: 'REGISTRATION' as const,
        amount: 10,
        reason: `Default registration credit for workshop '${workshop.name}' (Hall: ${sc.hallName})`,
        awardedBy: req.user!._id,
        approvedBy: req.user!._id,
        status: 'APPROVED' as const,
        createdAt: now,
        approvedAt: now,
      }));

      await CreditTransaction.insertMany(txDocs);
      newlyCreditedCount = studentsToCredit.length;

      // Recalculate level cache for newly credited students in parallel batches
      const recalculatePromises = studentsToCredit.map((sc) =>
        recalculateStudentLevelAndCache(sc.student._id)
      );
      await Promise.all(recalculatePromises);
    }

    workshop.studentsSetupCompleted = true;
    if (workshop.volunteersSetupCompleted) {
      workshop.status = 'Ready';
    }
    await workshop.save();

    await createAuditLog({
      req,
      action: 'EXCEL_PARTICIPANTS_IMPORTED',
      targetType: 'EVENT',
      targetId: workshop._id.toString(),
      reason: `Admin placed ${importedCount} students across halls in '${workshop.name}' (+10 pts credited to ${newlyCreditedCount} students)`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully placed ${importedCount} students into halls.${newlyCreditedCount > 0 ? ` Auto-awarded +10 registration credits to ${newlyCreditedCount} students.` : ' (All students were already credited; no duplicates added).' } Setup is ready!`,
      importedCount,
      newlyCreditedCount,
      workshopStatus: computeWorkshopLifecycleStatus(workshop),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 4 — Workshop Console Overview & Management Data
 */
export async function getWorkshopConsoleData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    const now = getCurrentISTDate();
    const computedStatus = computeWorkshopLifecycleStatus(workshop, now);
    const windowOpen = isWithinWindow(now, workshop.attendanceWindowStart, workshop.attendanceWindowEnd);
    const windowClosed = now.getTime() > new Date(workshop.attendanceWindowEnd).getTime();

    // 1. Overview Stats
    const registrations = await EventRegistration.find({ eventId: workshop._id, status: 'REGISTERED' })
      .populate('studentId', 'fullName influenceXId collegeStudentId branch year collegeEmail')
      .sort({ assignedOrder: 1 });

    const attendanceRecords = await Attendance.find({ eventId: workshop._id });
    const attendanceMap = new Map(attendanceRecords.map((a) => [a.studentId.toString(), a]));

    const participationRecords = await ParticipationRecord.find({ eventId: workshop._id });
    const participationMap = new Map(participationRecords.map((p) => [p.studentId.toString(), p]));

    const transactions = await CreditTransaction.find({ eventId: workshop._id, status: 'APPROVED' })
      .populate('studentId', 'fullName influenceXId collegeStudentId')
      .populate('awardedBy', 'name email role')
      .sort({ createdAt: -1 });

    const totalStudents = registrations.length;
    const attendedCount = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const creditsIssuedTotal = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Volunteer login activity
    const volunteerUsers = await User.find({
      assignedWorkshopId: workshop._id,
      role: 'VOLUNTEER',
    }).select('name ixId email assignedHallName lastLoginAt status');

    // Build per-hall student roster
    const studentRoster = registrations.map((reg: any) => {
      const sId = reg.studentId?._id?.toString() || '';
      const att = attendanceMap.get(sId);
      const part = participationMap.get(sId);
      const studentTxs = transactions.filter((t: any) => t.studentId?._id?.toString() === sId);

      const regCredit = studentTxs.find((t) => t.creditType === 'REGISTRATION')?.amount || 0;
      const attCredit = studentTxs.find((t) => t.creditType === 'ATTENDANCE')?.amount || 0;
      const partCredit = studentTxs.find((t) => t.creditType === 'INTERACTION' || t.creditType === 'PARTICIPATION')?.amount || 0;
      const totalEarnedInWorkshop = regCredit + attCredit + partCredit;
      const capRemaining = Math.max(0, (workshop.creditCap || 50) - totalEarnedInWorkshop);

      return {
        id: reg._id,
        studentId: sId,
        fullName: reg.studentId?.fullName,
        influenceXId: reg.studentId?.influenceXId,
        collegeStudentId: reg.studentId?.collegeStudentId,
        branch: reg.studentId?.branch,
        hallName: reg.hallName,
        attendanceStatus: att?.status || 'NOT_MARKED',
        attendanceMarkedBy: att?.markedBy ? 'Volunteer' : null,
        attendanceMarkedAt: att?.markedAt || null,
        participated: part?.participated || false,
        participationNotes: part?.notes || '',
        registrationCredit: regCredit,
        attendanceCredit: attCredit,
        participationCredit: partCredit,
        totalWorkshopCredits: totalEarnedInWorkshop,
      };
    });

    // Activity Log Traceability feed for this workshop
    const studentIdStrings = registrations.map((r: any) => r.studentId?._id?.toString()).filter(Boolean);
    const volunteerUserIds = volunteerUsers.map((v) => v._id);

    const auditLogs = await AuditLog.find({
      $or: [
        { targetId: workshop._id.toString() },
        { targetId: { $in: studentIdStrings } },
        { actorUserId: { $in: volunteerUserIds } },
        { action: { $in: ['ATTENDANCE_MARKED', 'PARTICIPATION_CREDIT_ASSIGNED', 'VOLUNTEER_ACTION_REJECTED', 'CREDENTIALS_GENERATED', 'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILURE', 'AUTH_LOGOUT', 'AUTH_PASSWORD_RESET'] } },
      ],
    })
      .populate('actorUserId', 'name ixId email role')
      .sort({ createdAt: -1 })
      .limit(100);

    const activityLogs = auditLogs.map((log: any) => ({
      id: log._id,
      timestamp: log.createdAt,
      actor: log.actorUserId ? `${log.actorUserId.name} (${log.actorUserId.ixId || log.actorRole})` : log.actorRole,
      action: log.action,
      targetId: log.targetId,
      beforeValue: log.beforeValue,
      afterValue: log.afterValue,
      reason: log.reason,
    }));

    res.status(200).json({
      success: true,
      workshop: {
        ...workshop.toJSON(),
        computedStatus,
      },
      stats: {
        totalStudents,
        attendedCount,
        attendanceRate: totalStudents > 0 ? Math.round((attendedCount / totalStudents) * 100) : 0,
        creditsIssuedTotal,
        creditCap: workshop.creditCap || 50,
        windowOpen,
        windowClosed,
        windowEndIST: dayjs(workshop.attendanceWindowEnd).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
      },
      halls: workshop.halls || [],
      volunteers: volunteerUsers,
      studentRoster,
      ledger: transactions.map((t) => t.toJSON()),
      activityLogs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 4 — Admin Overrides Attendance Anytime
 */
export async function adminOverrideAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { studentId, status } = req.body as { studentId: string; status: 'PRESENT' | 'ABSENT' };

    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    if (workshop.status === 'Ended') {
      res.status(400).json({ success: false, error: 'Workshop is Ended. All mutations are frozen.' });
      return;
    }

    const now = getCurrentISTDate();
    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    await Attendance.findOneAndUpdate(
      { eventId: workshop._id, studentId: student._id },
      {
        status,
        markedBy: req.user!._id,
        markedAt: now,
        correctionStatus: 'APPROVED',
      },
      { upsert: true, new: true }
    );

    // Auto-award +20 attendance credits if PRESENT, reject credits if ABSENT
    if (status === 'PRESENT') {
      const existingAttTx = await CreditTransaction.findOne({
        studentId: student._id,
        eventId: workshop._id,
        creditType: 'ATTENDANCE',
      });

      if (!existingAttTx) {
        const txId = await generateNextTransactionId();
        await CreditTransaction.create({
          transactionId: txId,
          studentId: student._id,
          eventId: workshop._id,
          creditType: 'ATTENDANCE',
          amount: 20,
          reason: `Physical attendance (+20 credits) verified by Admin for '${workshop.name}'`,
          awardedBy: req.user!._id,
          approvedBy: req.user!._id,
          status: 'APPROVED',
          createdAt: now,
          approvedAt: now,
        });
      } else if (existingAttTx.status !== 'APPROVED') {
        existingAttTx.status = 'APPROVED';
        existingAttTx.approvedAt = now;
        await existingAttTx.save();
      }
      await recalculateStudentLevelAndCache(student._id);
    } else if (status === 'ABSENT') {
      await CreditTransaction.updateMany(
        {
          eventId: workshop._id,
          studentId: student._id,
          creditType: { $in: ['ATTENDANCE', 'PARTICIPATION'] },
        },
        { status: 'REJECTED' }
      );
      await ParticipationRecord.deleteMany({
        eventId: workshop._id,
        studentId: student._id,
      });
      await recalculateStudentLevelAndCache(student._id);
    }

    await createAuditLog({
      req,
      action: 'ATTENDANCE_OVERRIDDEN',
      targetType: 'ATTENDANCE',
      targetId: student._id.toString(),
      reason: `Admin recorded attendance as '${status}' for student ${student.influenceXId} (${student.fullName}) in workshop '${workshop.name}'`,
    });

    res.status(200).json({
      success: true,
      message: `Attendance updated to '${status}' for ${student.fullName}.`,
      studentId: student._id.toString(),
      attendanceStatus: status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 4 — Admin Assigns Variable Participation Credit (Enforcing 50 Cap)
 */
export async function adminAssignParticipationCredit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { studentId, amount, reason } = req.body as {
      studentId: string;
      amount: number;
      reason: string;
    };

    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    if (workshop.status === 'Ended') {
      res.status(400).json({ success: false, error: 'Workshop is Ended. All mutations are frozen.' });
      return;
    }

    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    // Check 50-credit cap
    const currentWorkshopCredits = await CreditTransaction.aggregate([
      { $match: { eventId: workshop._id, studentId: student._id, status: 'APPROVED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const currentTotal = currentWorkshopCredits.length > 0 ? currentWorkshopCredits[0].total : 0;
    const cap = workshop.creditCap || 50;

    if (currentTotal + amount > cap) {
      res.status(400).json({
        success: false,
        error: `Credit cap exceeded: Student already has ${currentTotal} pts in this workshop. Adding ${amount} pts would exceed the ${cap} pts cap (Remaining allowance: ${Math.max(0, cap - currentTotal)} pts).`,
      });
      return;
    }

    const now = getCurrentISTDate();
    const txId = await generateNextTransactionId();

    const tx = await CreditTransaction.create({
      transactionId: txId,
      studentId: student._id,
      eventId: workshop._id,
      creditType: 'INTERACTION',
      amount,
      reason: reason || `Live interaction points awarded in workshop '${workshop.name}'`,
      awardedBy: req.user!._id,
      approvedBy: req.user!._id,
      status: 'APPROVED',
      createdAt: now,
      approvedAt: now,
    });

    await recalculateStudentLevelAndCache(student._id);

    await createAuditLog({
      req,
      action: 'CREDIT_AWARDED',
      targetType: 'CREDIT_TRANSACTION',
      targetId: tx._id.toString(),
      reason: `Awarded ${amount} participation points to ${student.influenceXId} (${student.fullName}) in '${workshop.name}'. Total workshop points: ${currentTotal + amount}/${cap}`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully awarded ${amount} participation credits to ${student.fullName}. Total: ${currentTotal + amount}/${cap} pts.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 4 — Reassign Student Hall
 */
export async function reassignStudentHall(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { studentId, targetHallName } = req.body as { studentId: string; targetHallName: string };

    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    const reg = await EventRegistration.findOne({ eventId: workshop._id, studentId });
    if (!reg) {
      res.status(404).json({ success: false, error: 'Student registration not found' });
      return;
    }

    const oldHall = reg.hallName;
    reg.hallName = targetHallName;
    await reg.save();

    await createAuditLog({
      req,
      action: 'EVENT_REGISTRATION_STATUS_UPDATED',
      targetType: 'EVENT_REGISTRATION',
      targetId: reg._id.toString(),
      reason: `Admin transferred student from '${oldHall}' to '${targetHallName}' in workshop '${workshop.name}'`,
    });

    res.status(200).json({
      success: true,
      message: `Student successfully transferred to '${targetHallName}'.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 4 — End Workshop and Freeze
 */
export async function endWorkshop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    workshop.status = 'Ended';
    workshop.updatedAt = getCurrentISTDate();
    await workshop.save();

    await createAuditLog({
      req,
      action: 'EVENT_STATUS_UPDATED',
      targetType: 'EVENT',
      targetId: workshop._id.toString(),
      reason: `Admin ended and frozen workshop '${workshop.name}' (${workshop.eventId})`,
    });

    res.status(200).json({
      success: true,
      message: `Workshop '${workshop.name}' is now Ended. All attendance and credits are permanently frozen.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 4 & Setup — Admin Reassigns Volunteer to a Different Hall Live Anytime
 */
export async function reassignVolunteerHall(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { ixId, targetHallName } = req.body as { ixId: string; targetHallName: string };

    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    if (!workshop.halls.some((h) => h.name === targetHallName)) {
      res.status(400).json({ success: false, error: `Hall '${targetHallName}' does not exist in this workshop.` });
      return;
    }

    // Find and transfer volunteer
    let volunteerData: any = null;
    workshop.halls.forEach((hall) => {
      if (hall.assignedVolunteers) {
        const found = hall.assignedVolunteers.find((v) => v.ixId === ixId);
        if (found) {
          volunteerData = {
            userId: found.userId,
            name: found.name,
            ixId: found.ixId,
            niatId: found.niatId,
          };
          hall.assignedVolunteers = hall.assignedVolunteers.filter((v) => v.ixId !== ixId);
        }
      }
    });

    if (!volunteerData) {
      res.status(404).json({ success: false, error: `Volunteer with IXID '${ixId}' not found in this workshop.` });
      return;
    }

    const targetHall = workshop.halls.find((h) => h.name === targetHallName);
    if (targetHall) {
      if (!targetHall.assignedVolunteers) targetHall.assignedVolunteers = [];
      targetHall.assignedVolunteers.push({
        userId: volunteerData.userId,
        name: volunteerData.name,
        ixId: volunteerData.ixId,
        niatId: volunteerData.niatId || '',
        assignedAt: getCurrentISTDate(),
      });
    }

    await workshop.save();

    // Instantly update User record for live session scoping
    await User.findOneAndUpdate(
      { ixId },
      { assignedHallName: targetHallName, assignedWorkshopId: workshop._id }
    );

    await createAuditLog({
      req,
      action: 'USER_UPDATED',
      targetType: 'USER',
      targetId: volunteerData.userId ? volunteerData.userId.toString() : ixId,
      reason: `Admin transferred volunteer ${volunteerData.name} (${ixId}) to hall '${targetHallName}' in workshop '${workshop.name}'`,
    });

    res.status(200).json({
      success: true,
      message: `Volunteer ${volunteerData.name} (${ixId}) successfully transferred to '${targetHallName}'.`,
      halls: workshop.halls,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin Revokes Auto-Awarded Registration Credits (+10) for a Workshop
 */
export async function revokeRegistrationCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const workshop = await Event.findById(id);
    if (!workshop) {
      res.status(404).json({ success: false, error: 'Workshop not found' });
      return;
    }

    // Find all registration credit transactions for this workshop
    const regTxs = await CreditTransaction.find({
      eventId: workshop._id,
      creditType: 'REGISTRATION',
    });

    if (regTxs.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No registration credits found for this workshop to revoke.',
        revokedCount: 0,
      });
      return;
    }

    const affectedStudentIds = [...new Set(regTxs.map((t) => t.studentId.toString()))];

    // Mark registration credit transactions for this workshop as REJECTED to revoke
    await CreditTransaction.updateMany(
      {
        eventId: workshop._id,
        creditType: 'REGISTRATION',
      },
      { status: 'REJECTED' }
    );

    // Recalculate level & cached total credits for all affected students
    const recalculatePromises = affectedStudentIds.map((sId) =>
      recalculateStudentLevelAndCache(new Types.ObjectId(sId))
    );
    await Promise.all(recalculatePromises);

    // Audit log entry
    await createAuditLog({
      req,
      action: 'REGISTRATION_CREDITS_REVOKED',
      targetType: 'EVENT',
      targetId: workshop._id.toString(),
      reason: `Admin revoked ${regTxs.length} auto-awarded registration credits (+10 pts each) for workshop '${workshop.name}' (${workshop.eventId})`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully revoked ${regTxs.length} auto-awarded registration credits (+10 pts each) for ${affectedStudentIds.length} student(s).`,
      revokedCount: regTxs.length,
      affectedStudentsCount: affectedStudentIds.length,
    });
  } catch (error) {
    next(error);
  }
}
