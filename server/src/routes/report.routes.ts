import { Router } from 'express';
import { getMonthlyReportData, exportMonthlyReportExcel } from '../controllers/report.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Monthly Report in-app preview
router.get(
  '/monthly',
  requireAuth,
  requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'),
  getMonthlyReportData
);

// Multi-Sheet Monthly Report Excel download
router.get(
  '/monthly/export',
  requireAuth,
  requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'),
  exportMonthlyReportExcel
);

export default router;
