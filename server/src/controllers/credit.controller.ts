import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { CreditTransaction, CreditTransactionStatus } from '../models/CreditTransaction';
import { CreditRule } from '../models/CreditRule';
import { Event } from '../models/Event';
import { Student } from '../models/Student';
import { generateNextTransactionId } from '../utils/sequence';
import { recalculateStudentLevelAndCache, getStudentLiveCredits } from '../utils/ledger';
import { isWithinWindow } from '../utils/window';
import { createAuditLog } from '../utils/audit';
import { getCurrentISTDate, dayjs, DEFAULT_TIMEZONE } from '../utils/timezone';

const awardSingleCreditSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  eventId: z.string().optional().nullable(),
  creditType: z.enum([
    'REGISTRATION',
    'ATTENDANCE',
    'PARTICIPATION',
    'INTERACTION',
    'FINALIST',
    'WINNER',
    'RUNNER_UP',
    'VOLUNTEER',
    'TEAM_MEMBER',
    'TEAM_LEAD',
    'COMMUNITY_CONTRIBUTION',
    'SPECIAL_RECOGNITION',
    'MANUAL_ADJUSTMENT',
    'CORRECTION',
    'REVERSAL',
  ]),
  amount: z.number(),
  reason: z.string().min(3, 'Mandatory description required'),
  relatesTo: z.string().optional().nullable(),
});

const bulkAwardCreditSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  creditType: z.enum([
    'REGISTRATION',
    'ATTENDANCE',
    'PARTICIPATION',
    'INTERACTION',
    'FINALIST',
    'WINNER',
    'RUNNER_UP',
    'VOLUNTEER',
    'TEAM_MEMBER',
    'TEAM_LEAD',
    'COMMUNITY_CONTRIBUTION',
    'SPECIAL_RECOGNITION',
    'MANUAL_ADJUSTMENT',
    'CORRECTION',
    'REVERSAL',
  ]),
  amount: z.number().optional(),
  reason: z.string().min(3, 'Mandatory reason required'),
  studentIds: z.array(z.string()).min(1, 'At least one student must be selected'),
});

const approveTransactionSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

export async function listGlobalLedger(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { studentId, eventId, creditType, status, page = '1', limit = '20' } = req.query;

    const query: any = {};
    if (studentId) query.studentId = new Types.ObjectId(studentId.toString());
    if (eventId) query.eventId = new Types.ObjectId(eventId.toString());
    if (creditType) query.creditType = creditType;
    if (status) query.status = status;

    const pageNum = parseInt(page.toString(), 10) || 1;
    const limitNum = parseInt(limit.toString(), 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      CreditTransaction.find(query)
        .populate('studentId', 'fullName influenceXId collegeStudentId branch year')
        .populate('eventId', 'name eventId')
        .populate('awardedBy', 'name email role')
        .populate('approvedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CreditTransaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      transactions: transactions.map((t) => t.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

export async function listEventCredits(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const transactions = await CreditTransaction.find({ eventId: id })
      .populate('studentId', 'fullName influenceXId collegeStudentId branch')
      .populate('awardedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions: transactions.map((t) => t.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

export async function awardSingleCredit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { studentId, eventId, creditType, amount, reason, relatesTo } =
      awardSingleCreditSchema.parse(req.body);

    const now = getCurrentISTDate();
    const actorUser = req.user!;

    // 1. Enforce Role & Self-Award Prevention
    if (actorUser.role === 'STUDENT') {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Students are never permitted to award credits.',
      });
      return;
    }

    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    // Explicit self-award rejection if user IDs match
    if (student.userId.toString() === actorUser._id.toString()) {
      res.status(403).json({
        success: false,
        error: 'Security Rejection: You cannot award credits to your own student account.',
      });
      return;
    }

    // 2. Fetch Rule
    const rule = await CreditRule.findOne({ type: creditType });
    let requiresSecondApproval = rule ? rule.requiresSecondApproval : false;

    // 3. Event Time-Window Check (if linked to an event)
    if (eventId) {
      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({ success: false, error: 'Linked event not found' });
        return;
      }

      const windowOpen = isWithinWindow(now, event.creditWindowStart, event.creditWindowEnd);
      if (!windowOpen) {
        // Window is CLOSED: Only CORRECTION/REVERSAL allowed with mandatory second approval
        if (creditType !== 'CORRECTION' && creditType !== 'REVERSAL') {
          res.status(400).json({
            success: false,
            error: `Credit window is closed for event '${event.name}'. Standard credits cannot be awarded after window closed on ${dayjs(
              event.creditWindowEnd
            )
              .tz(DEFAULT_TIMEZONE)
              .format('YYYY-MM-DD HH:mm:ss')} IST. Submit a 'CORRECTION' type transaction instead.`,
          });
          return;
        }

        requiresSecondApproval = true; // Always require 2nd approval for post-window corrections
      }
    }

    // 4. Determine initial status
    const status: CreditTransactionStatus = requiresSecondApproval
      ? 'PENDING_APPROVAL'
      : 'APPROVED';

    const transactionId = await generateNextTransactionId();

    const transaction = await CreditTransaction.create({
      transactionId,
      studentId: student._id,
      eventId: eventId ? new Types.ObjectId(eventId) : null,
      creditType,
      amount,
      reason,
      relatesTo: relatesTo || null,
      awardedBy: actorUser._id,
      approvedBy: status === 'APPROVED' ? actorUser._id : null,
      status,
      createdAt: now,
      approvedAt: status === 'APPROVED' ? now : null,
    });

    // 5. Update student cache & tier if immediately approved
    if (status === 'APPROVED') {
      await recalculateStudentLevelAndCache(student._id);
    }

    // 6. Record AuditLog
    await createAuditLog({
      req,
      action: status === 'APPROVED' ? 'CREDIT_AWARDED' : 'CREDIT_PENDING_APPROVAL',
      targetType: 'CREDIT_TRANSACTION',
      targetId: transaction._id.toString(),
      afterValue: transaction.toJSON(),
      reason: `Awarded ${amount} credits (${creditType}) to ${student.influenceXId} (${student.fullName}). Status: ${status}`,
    });

    res.status(201).json({
      success: true,
      message:
        status === 'APPROVED'
          ? `Successfully awarded ${amount} credits to ${student.fullName}.`
          : `Credit transaction ${transactionId} submitted for second administrator approval.`,
      transaction: transaction.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkAwardCredits(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { eventId, creditType, amount, reason, studentIds } =
      bulkAwardCreditSchema.parse(req.body);

    const now = getCurrentISTDate();
    const actorUser = req.user!;

    if (actorUser.role === 'STUDENT') {
      res.status(403).json({ success: false, error: 'Forbidden: Students cannot award credits.' });
      return;
    }

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    // Window Check
    const windowOpen = isWithinWindow(now, event.creditWindowStart, event.creditWindowEnd);
    if (!windowOpen) {
      res.status(400).json({
        success: false,
        error: `Credit window is closed for event '${event.name}'. Bulk awarding is locked after window closed on ${dayjs(
          event.creditWindowEnd
        )
          .tz(DEFAULT_TIMEZONE)
          .format('YYYY-MM-DD HH:mm:ss')} IST.`,
      });
      return;
    }

    // Fetch Rule for default amount
    const rule = await CreditRule.findOne({ type: creditType });
    const finalAmount = amount !== undefined ? amount : rule ? rule.defaultAmount : 10;
    const requiresSecondApproval = rule ? rule.requiresSecondApproval : false;
    const status: CreditTransactionStatus = requiresSecondApproval
      ? 'PENDING_APPROVAL'
      : 'APPROVED';

    const createdTransactions = [];
    for (const studentId of studentIds) {
      const student = await Student.findById(studentId);
      if (!student) continue;

      // Skip self-awards
      if (student.userId.toString() === actorUser._id.toString()) continue;

      const transactionId = await generateNextTransactionId();
      const tx = await CreditTransaction.create({
        transactionId,
        studentId: student._id,
        eventId: event._id,
        creditType,
        amount: finalAmount,
        reason,
        awardedBy: actorUser._id,
        approvedBy: status === 'APPROVED' ? actorUser._id : null,
        status,
        createdAt: now,
        approvedAt: status === 'APPROVED' ? now : null,
      });

      createdTransactions.push(tx);

      if (status === 'APPROVED') {
        await recalculateStudentLevelAndCache(student._id);
      }
    }

    // Record Batch AuditLog
    await createAuditLog({
      req,
      action: 'CREDIT_BULK_AWARDED',
      targetType: 'CREDIT_TRANSACTION',
      targetId: event._id.toString(),
      afterValue: {
        eventId: event.eventId,
        creditType,
        amountPerStudent: finalAmount,
        totalStudentsAwarded: createdTransactions.length,
        status,
      },
      reason: `Bulk awarded ${finalAmount} credits (${creditType}) to ${createdTransactions.length} students for event ${event.eventId}`,
    });

    res.status(201).json({
      success: true,
      message: `Bulk credit batch completed: ${createdTransactions.length} individual transactions created (${finalAmount * createdTransactions.length} total points).`,
      count: createdTransactions.length,
      totalCreditsAwarded: finalAmount * createdTransactions.length,
      transactions: createdTransactions.map((t) => t.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

export async function approveCreditTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { transactionId } = req.params;
    const { approved, notes } = approveTransactionSchema.parse(req.body);
    const actorUser = req.user!;

    const transaction = await CreditTransaction.findOne({
      $or: [{ _id: Types.ObjectId.isValid(transactionId) ? transactionId : null }, { transactionId }],
    });

    if (!transaction) {
      res.status(404).json({ success: false, error: 'Credit transaction not found' });
      return;
    }

    if (transaction.status !== 'PENDING_APPROVAL') {
      res.status(400).json({
        success: false,
        error: `Transaction is already resolved with status '${transaction.status}'.`,
      });
      return;
    }

    const beforeValue = transaction.toJSON();
    const now = getCurrentISTDate();

    if (approved) {
      transaction.status = 'APPROVED';
      transaction.approvedBy = actorUser._id;
      transaction.approvedAt = now;
      await transaction.save();

      await recalculateStudentLevelAndCache(transaction.studentId);

      await createAuditLog({
        req,
        action: 'CREDIT_APPROVED',
        targetType: 'CREDIT_TRANSACTION',
        targetId: transaction._id.toString(),
        beforeValue,
        afterValue: transaction.toJSON(),
        reason: `Second approval granted for credit transaction ${transaction.transactionId}. Notes: ${notes || 'None'}`,
      });

      res.status(200).json({
        success: true,
        message: `Transaction ${transaction.transactionId} approved and student ledger updated.`,
        transaction: transaction.toJSON(),
      });
    } else {
      transaction.status = 'REJECTED';
      transaction.approvedBy = actorUser._id;
      transaction.approvedAt = now;
      await transaction.save();

      await createAuditLog({
        req,
        action: 'CREDIT_REJECTED',
        targetType: 'CREDIT_TRANSACTION',
        targetId: transaction._id.toString(),
        beforeValue,
        afterValue: transaction.toJSON(),
        reason: `Credit transaction ${transaction.transactionId} rejected by admin. Reason: ${notes || 'None'}`,
      });

      res.status(200).json({
        success: true,
        message: `Transaction ${transaction.transactionId} rejected.`,
        transaction: transaction.toJSON(),
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function getStudentCreditLedger(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    const liveTotal = await getStudentLiveCredits(student._id);
    const transactions = await CreditTransaction.find({
      studentId: student._id,
    })
      .populate('eventId', 'name eventId')
      .populate('awardedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      student: {
        id: student._id.toString(),
        fullName: student.fullName,
        influenceXId: student.influenceXId,
        currentLevel: student.currentLevel,
        liveTotalCredits: liveTotal,
        cachedCredits: student.cachedTotalCredits,
      },
      count: transactions.length,
      transactions: transactions.map((t) => t.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyCreditLedger(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const student = await Student.findOne({ userId: req.user!._id });
    if (!student) {
      res.status(404).json({ success: false, error: 'Student profile not found' });
      return;
    }

    const liveTotal = await getStudentLiveCredits(student._id);
    const transactions = await CreditTransaction.find({
      studentId: student._id,
    })
      .populate('eventId', 'name eventId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      student: {
        fullName: student.fullName,
        influenceXId: student.influenceXId,
        currentLevel: student.currentLevel,
        liveTotalCredits: liveTotal,
      },
      count: transactions.length,
      transactions: transactions.map((t) => t.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}
