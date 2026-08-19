import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const action = req.query.action as string;
    const actorRole = req.query.actorRole as string;
    const targetType = req.query.targetType as string;
    const search = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const query: any = {};

    if (action) query.action = action;
    if (actorRole) query.actorRole = actorRole;
    if (targetType) query.targetType = targetType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { reason: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { targetId: { $regex: search, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorUserId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      logs: logs.map((log) => ({
        id: log._id,
        actor: log.actorUserId,
        actorRole: log.actorRole,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        beforeValue: log.beforeValue,
        afterValue: log.afterValue,
        reason: log.reason,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Audit] Error querying audit logs:', error);
    res.status(500).json({ error: 'Failed to retrieve audit log stream.' });
  }
}

export async function getAuditLogById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const log = await AuditLog.findById(id).populate('actorUserId', 'name email role').lean();
    if (!log) {
      res.status(404).json({ error: 'Audit log record not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      log: {
        id: log._id,
        actor: log.actorUserId,
        actorRole: log.actorRole,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        beforeValue: log.beforeValue,
        afterValue: log.afterValue,
        reason: log.reason,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      },
    });
  } catch (error) {
    console.error('[Audit] Error fetching audit log details:', error);
    res.status(500).json({ error: 'Failed to retrieve audit record details.' });
  }
}
