import { Router } from 'express';
import { listAuditLogs, getAuditLogById } from '../controllers/audit.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Read-only audit log stream (ADMIN only)
router.get('/', requireAuth, requireRole('ADMIN'), listAuditLogs);
router.get('/:id', requireAuth, requireRole('ADMIN'), getAuditLogById);

export default router;
