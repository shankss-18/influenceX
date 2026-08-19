import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analytics.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Real-time KPI aggregations and analytics (Admin, Event Team, Faculty)
router.get(
  '/dashboard',
  requireAuth,
  requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'),
  getDashboardAnalytics
);

export default router;
