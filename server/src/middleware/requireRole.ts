import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';
import { createAuditLog } from '../utils/audit';

export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Prompt requirement: "Every login, logout, and role-restricted denial must write an AuditLog entry."
      await createAuditLog({
        req,
        actorUserId: req.user._id,
        actorRole: req.user.role,
        action: 'AUTH_FORBIDDEN_ACCESS',
        targetType: 'API_ENDPOINT',
        targetId: req.originalUrl,
        reason: `Role '${req.user.role}' attempted unauthorized access to restricted resource. Allowed roles: ${allowedRoles.join(', ')}`,
      });

      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to perform this action',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}
