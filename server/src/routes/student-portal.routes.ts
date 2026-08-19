import { Router } from 'express';
import { getStudentPortalData } from '../controllers/student-portal.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Student Single-Page Workflow Endpoint (Strictly Scoped)
router.get('/portal', requireAuth, requireRole('STUDENT'), getStudentPortalData);

export default router;
