import { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { getCurrentISTDate } from './timezone';

interface AuditLogParams {
  req?: Request;
  actorUserId?: Types.ObjectId | string | null;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeValue?: any;
  afterValue?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    let ip = params.ipAddress;
    let ua = params.userAgent;
    let actorUserId = params.actorUserId ? new Types.ObjectId(params.actorUserId) : null;
    let actorRole = params.actorRole || 'ANONYMOUS';

    if (params.req) {
      const req = params.req;
      ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      ua = req.headers['user-agent'] || 'unknown';

      // If user is attached to request from requireAuth
      if ((req as any).user) {
        actorUserId = actorUserId || (req as any).user._id;
        actorRole = actorRole === 'ANONYMOUS' ? (req as any).user.role : actorRole;
      }
    }

    await AuditLog.create({
      actorUserId,
      actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      beforeValue: params.beforeValue,
      afterValue: params.afterValue,
      reason: params.reason,
      ipAddress: ip,
      userAgent: ua,
      createdAt: getCurrentISTDate(),
    });
  } catch (error) {
    // Audit logging should never crash the main request flow, but should be logged to console
    console.error('[AuditLog] Failed to record audit log:', error);
  }
}
