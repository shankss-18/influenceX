import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { generateNextInfluenceXId } from '../utils/sequence';
import { hashPassword } from '../utils/jwt';
import { createAuditLog } from '../utils/audit';
import { getCurrentISTDate } from '../utils/timezone';

const createStudentSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  collegeEmail: z.string().email().toLowerCase().trim(),
  password: z.string().min(6).optional().default('Student@123456'),
  collegeStudentId: z.string().min(1).max(50).trim(),
  phone: z.string().optional().default(''),
  branch: z.string().min(1).max(30).trim().toUpperCase(),
  year: z.number().min(1).max(5),
  section: z.string().min(1).max(10).trim().toUpperCase(),
  status: z.enum(['PENDING', 'APPROVED', 'DISABLED']).optional().default('APPROVED'),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DISABLED']),
  reason: z.string().optional(),
});

export async function listStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const search = (req.query.search as string || '').trim();
    const branch = (req.query.branch as string || '').trim().toUpperCase();
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const section = (req.query.section as string || '').trim().toUpperCase();
    const status = (req.query.status as string || '').trim().toUpperCase();

    const query: any = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { collegeEmail: { $regex: search, $options: 'i' } },
        { collegeStudentId: { $regex: search, $options: 'i' } },
        { influenceXId: { $regex: search, $options: 'i' } },
      ];
    }

    if (branch) query.branch = branch;
    if (year) query.year = year;
    if (section) query.section = section;
    if (status && ['PENDING', 'APPROVED', 'DISABLED'].includes(status)) {
      query.status = status;
    }

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      students: students.map((s) => s.toJSON()),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getStudentById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    let query: any;
    if (Types.ObjectId.isValid(id)) {
      query = { $or: [{ _id: id }, { influenceXId: id }, { userId: id }] };
    } else {
      query = { influenceXId: id };
    }

    const student = await Student.findOne(query).populate('userId', 'email role status lastLoginAt');
    if (!student) {
      res.status(404).json({
        success: false,
        error: 'Student record not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      student: student.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyStudentProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      res.status(404).json({
        success: false,
        error: 'Student profile not found for the authenticated account',
      });
      return;
    }

    res.status(200).json({
      success: true,
      student: student.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createStudentSchema.parse(req.body);

    const existingEmail = await User.findOne({ email: data.collegeEmail });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        error: 'A user account with this college email already exists',
      });
      return;
    }

    const existingCollegeId = await Student.findOne({ collegeStudentId: data.collegeStudentId });
    if (existingCollegeId) {
      res.status(409).json({
        success: false,
        error: 'A student with this college roll/ID is already registered',
      });
      return;
    }

    // 1. Generate atomic InfluenceX ID
    const influenceXId = await generateNextInfluenceXId();

    // 2. Create User account for authentication
    const passwordHash = await hashPassword(data.password);
    const user = await User.create({
      name: data.fullName,
      email: data.collegeEmail,
      passwordHash,
      role: 'STUDENT',
      status: data.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
      createdAt: getCurrentISTDate(),
    });

    // 3. Create Student profile
    const student = await Student.create({
      userId: user._id,
      influenceXId,
      collegeStudentId: data.collegeStudentId,
      fullName: data.fullName,
      collegeEmail: data.collegeEmail,
      phone: data.phone,
      branch: data.branch,
      year: data.year,
      section: data.section,
      status: data.status,
      cachedTotalCredits: 0,
      currentLevel: 'Explorer',
      joiningDate: getCurrentISTDate(),
      createdAt: getCurrentISTDate(),
      updatedAt: getCurrentISTDate(),
    });

    // 4. Record AuditLog
    await createAuditLog({
      req,
      action: 'STUDENT_PROVISIONED',
      targetType: 'STUDENT',
      targetId: student._id.toString(),
      afterValue: student.toJSON(),
      reason: `Student ${data.fullName} (${influenceXId}) provisioned by admin`,
    });

    res.status(201).json({
      success: true,
      message: 'Student account provisioned successfully',
      student: student.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStudentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status, reason } = updateStatusSchema.parse(req.body);

    const student = await Student.findById(id);
    if (!student) {
      res.status(404).json({
        success: false,
        error: 'Student record not found',
      });
      return;
    }

    const beforeValue = student.toJSON();
    student.status = status;
    student.updatedAt = getCurrentISTDate();
    await student.save();

    // Synchronize User status if DISABLED
    await User.findByIdAndUpdate(student.userId, {
      status: status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    });

    await createAuditLog({
      req,
      action: 'STUDENT_STATUS_UPDATED',
      targetType: 'STUDENT',
      targetId: student._id.toString(),
      beforeValue,
      afterValue: student.toJSON(),
      reason: reason || `Status updated to ${status} for ${student.fullName} (${student.influenceXId})`,
    });

    res.status(200).json({
      success: true,
      message: `Student status updated to ${status}`,
      student: student.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}
