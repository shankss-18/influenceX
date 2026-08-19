import { Router } from 'express';
import {
  getLeaderboard,
  getMonthlySnapshots,
  triggerMonthlySnapshot,
  getStudentInspectionDetails,
} from '../controllers/leaderboard.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/', requireAuth, getLeaderboard);
router.get('/students/:studentId/details', requireAuth, getStudentInspectionDetails);
router.get('/snapshots', requireAuth, getMonthlySnapshots);
router.post('/snapshots/trigger', requireAuth, requireRole('ADMIN'), triggerMonthlySnapshot);

export default router;
