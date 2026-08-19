import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Event } from '../models/Event';
import { Student } from '../models/Student';
import { EventRegistration } from '../models/EventRegistration';
import { Attendance } from '../models/Attendance';
import { ParticipationRecord } from '../models/ParticipationRecord';
import { exportToExcel } from '../utils/excel';
import { formatToIST, getCurrentISTDate, dayjs, DEFAULT_TIMEZONE } from '../utils/timezone';

export async function exportEventAttendance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const event = await Event.findById(id).populate('categoryId', 'name');
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    const registrations = await EventRegistration.find({
      eventId: event._id,
      status: 'REGISTERED',
    }).populate('studentId');

    const studentIds = registrations.map((r) => r.studentId._id);

    const [attendanceRecords, participationRecords] = await Promise.all([
      Attendance.find({ eventId: event._id, studentId: { $in: studentIds } }),
      ParticipationRecord.find({ eventId: event._id, studentId: { $in: studentIds } }),
    ]);

    const attMap = new Map<string, any>();
    attendanceRecords.forEach((a) => attMap.set(a.studentId.toString(), a));

    const partMap = new Map<string, any>();
    participationRecords.forEach((p) => partMap.set(p.studentId.toString(), p));

    const rows = registrations.map((reg, index) => {
      const student = reg.studentId as any;
      const att = attMap.get(student._id.toString());
      const part = partMap.get(student._id.toString());

      return {
        sNo: index + 1,
        influenceXId: student.influenceXId,
        collegeStudentId: student.collegeStudentId,
        fullName: student.fullName,
        collegeEmail: student.collegeEmail,
        branch: student.branch,
        academicYear: `Year ${student.year} (${student.section})`,
        registeredAt: formatToIST(reg.registeredAt),
        attendanceStatus: att ? att.status : 'UNMARKED',
        markedAt: att ? formatToIST(att.markedAt) : '—',
        participated: part ? (part.participated ? 'YES' : 'NO') : 'NO',
        participationNotes: part?.notes || '—',
      };
    });

    const timestamp = dayjs().tz(DEFAULT_TIMEZONE).format('YYYYMMDD_HHmm');
    const fileName = `Attendance_${event.eventId}_${timestamp}`;

    await exportToExcel({
      res,
      fileName,
      sheetName: 'Event Attendance',
      columns: [
        { header: 'S.No', key: 'sNo', width: 8 },
        { header: 'InfluenceX ID', key: 'influenceXId', width: 16 },
        { header: 'College Roll No', key: 'collegeStudentId', width: 18 },
        { header: 'Student Name', key: 'fullName', width: 24 },
        { header: 'Official Email', key: 'collegeEmail', width: 28 },
        { header: 'Branch', key: 'branch', width: 12 },
        { header: 'Class & Sec', key: 'academicYear', width: 16 },
        { header: 'Registered (IST)', key: 'registeredAt', width: 20 },
        { header: 'Attendance Status', key: 'attendanceStatus', width: 18 },
        { header: 'Marked At (IST)', key: 'markedAt', width: 20 },
        { header: 'Participated', key: 'participated', width: 14 },
        { header: 'Notes', key: 'participationNotes', width: 24 },
      ],
      rows,
    });
  } catch (error) {
    next(error);
  }
}

export async function exportStudents(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const students = await Student.find().sort({ influenceXId: 1 });

    const rows = students.map((s, index) => ({
      sNo: index + 1,
      influenceXId: s.influenceXId,
      collegeStudentId: s.collegeStudentId,
      fullName: s.fullName,
      collegeEmail: s.collegeEmail,
      phone: s.phone || '—',
      branch: s.branch,
      year: s.year,
      section: s.section,
      status: s.status,
      cachedCredits: s.cachedTotalCredits,
      level: s.currentLevel,
      joiningDate: formatToIST(s.joiningDate, 'YYYY-MM-DD'),
    }));

    const timestamp = dayjs().tz(DEFAULT_TIMEZONE).format('YYYYMMDD_HHmm');
    const fileName = `Students_Directory_${timestamp}`;

    await exportToExcel({
      res,
      fileName,
      sheetName: 'Students Roster',
      columns: [
        { header: 'S.No', key: 'sNo', width: 8 },
        { header: 'InfluenceX ID', key: 'influenceXId', width: 16 },
        { header: 'College Roll No', key: 'collegeStudentId', width: 18 },
        { header: 'Full Name', key: 'fullName', width: 24 },
        { header: 'College Email', key: 'collegeEmail', width: 28 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Branch', key: 'branch', width: 12 },
        { header: 'Year', key: 'year', width: 10 },
        { header: 'Sec', key: 'section', width: 10 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Credits (Cache)', key: 'cachedCredits', width: 16 },
        { header: 'Tier Level', key: 'level', width: 14 },
        { header: 'Enrolled Date', key: 'joiningDate', width: 16 },
      ],
      rows,
    });
  } catch (error) {
    next(error);
  }
}

export async function exportEvents(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const events = await Event.find().populate('categoryId', 'name').sort({ date: -1 });

    const eventIds = events.map((e) => e._id);
    const regCounts = await EventRegistration.aggregate([
      { $match: { eventId: { $in: eventIds }, status: 'REGISTERED' } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>();
    regCounts.forEach((r) => countMap.set(r._id.toString(), r.count));

    const rows = events.map((e, index) => {
      const catName = typeof e.categoryId === 'string' ? '—' : (e.categoryId as any)?.name || 'General';
      const regCount = countMap.get(e._id.toString()) || 0;

      return {
        sNo: index + 1,
        eventId: e.eventId,
        name: e.name,
        category: catName,
        eventDate: formatToIST(e.date, 'YYYY-MM-DD'),
        timing: `${e.startTime} - ${e.endTime}`,
        venue: e.venue,
        capacity: e.capacity,
        registered: regCount,
        status: e.status,
        regStart: formatToIST(e.registrationStart),
        regEnd: formatToIST(e.registrationEnd),
        attStart: formatToIST(e.attendanceWindowStart),
        attEnd: formatToIST(e.attendanceWindowEnd),
      };
    });

    const timestamp = dayjs().tz(DEFAULT_TIMEZONE).format('YYYYMMDD_HHmm');
    const fileName = `Events_Catalog_${timestamp}`;

    await exportToExcel({
      res,
      fileName,
      sheetName: 'Events List',
      columns: [
        { header: 'S.No', key: 'sNo', width: 8 },
        { header: 'Event ID', key: 'eventId', width: 16 },
        { header: 'Event Name', key: 'name', width: 28 },
        { header: 'Category', key: 'category', width: 16 },
        { header: 'Event Date', key: 'eventDate', width: 14 },
        { header: 'Timing', key: 'timing', width: 18 },
        { header: 'Venue', key: 'venue', width: 20 },
        { header: 'Capacity', key: 'capacity', width: 12 },
        { header: 'Registered', key: 'registered', width: 14 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Reg Opens (IST)', key: 'regStart', width: 20 },
        { header: 'Reg Closes (IST)', key: 'regEnd', width: 20 },
        { header: 'Att Opens (IST)', key: 'attStart', width: 20 },
        { header: 'Att Closes (IST)', key: 'attEnd', width: 20 },
      ],
      rows,
    });
  } catch (error) {
    next(error);
  }
}
