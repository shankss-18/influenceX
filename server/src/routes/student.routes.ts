import { Router } from 'express';
import {
  listStudents,
  getStudentById,
  getMyStudentProfile,
  createStudent,
  updateStudentStatus,
} from '../controllers/student.controller';
import { exportStudents } from '../controllers/export.controller';
import { getStudentCreditLedger, getMyCreditLedger } from '../controllers/credit.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Student self profile & ledger
router.get('/me/profile', requireAuth, requireRole('STUDENT'), getMyStudentProfile);
router.get('/me/credits', requireAuth, requireRole('STUDENT'), getMyCreditLedger);

// Export Students to Excel
router.get('/export', requireAuth, requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'), exportStudents);

// Staff / Admin read access (server-side paginated & filtered)
router.get('/', requireAuth, requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'), listStudents);
router.get('/:id', requireAuth, requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'), getStudentById);
router.get('/:id/credits', requireAuth, requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'), getStudentCreditLedger);

// Admin-only mutations
router.post('/', requireAuth, requireRole('ADMIN'), createStudent);
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), updateStudentStatus);

export default router;
