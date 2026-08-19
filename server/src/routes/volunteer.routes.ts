import { Router } from 'express';
import {
  getVolunteerActiveSession,
  volunteerMarkAttendance,
  volunteerAwardPerformanceCredit,
} from '../controllers/volunteer.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Volunteer Single-Page Workflow Endpoints (Strictly Scoped)
router.get('/active-session', requireAuth, requireRole('VOLUNTEER'), getVolunteerActiveSession);
router.post('/attendance', requireAuth, requireRole('VOLUNTEER'), volunteerMarkAttendance);
router.post('/credits', requireAuth, requireRole('VOLUNTEER'), volunteerAwardPerformanceCredit);

export default router;
