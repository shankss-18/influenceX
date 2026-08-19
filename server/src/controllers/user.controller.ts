import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { hashPassword } from '../utils/jwt';
import { createAuditLog } from '../utils/audit';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(['STUDENT', 'VOLUNTEER', 'EVENT_TEAM', 'ADMIN', 'FACULTY']),
  status: z.enum(['ACTIVE', 'DISABLED']).optional().default('ACTIVE'),
});

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = createUserSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'A user with this email address already exists',
      });
      return;
    }

    const passwordHash = await hashPassword(validatedData.password);

    const newUser = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      passwordHash,
      role: validatedData.role,
      status: validatedData.status,
    });

    // Record audit log (passwords never logged)
    await createAuditLog({
      req,
      actorUserId: req.user?._id,
      actorRole: req.user?.role || 'ADMIN',
      action: 'USER_CREATED',
      targetType: 'USER',
      targetId: newUser._id.toString(),
      afterValue: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
      reason: `Account created by administrator ${req.user?.name || ''} (${req.user?.email || ''})`,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users: users.map((u) => u.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}
