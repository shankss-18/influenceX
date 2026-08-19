import { Router } from 'express';
import {
  listEvents,
  getEventById,
  createEvent,
  updateEvent,
  registerForEvent,
  listEventRegistrations,
} from '../controllers/event.controller';
import {
  previewParticipantImport,
  commitParticipantImport,
  listEventImports,
  downloadErrorReport,
} from '../controllers/import.controller';
import {
  listEventAttendance,
  markAttendance,
  requestAttendanceCorrection,
  approveAttendanceCorrection,
} from '../controllers/attendance.controller';
import { recordParticipation } from '../controllers/participation.controller';
import { listEventCredits, bulkAwardCredits } from '../controllers/credit.controller';
import { exportEventAttendance, exportEvents } from '../controllers/export.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { uploadExcel } from '../utils/multer';

const router = Router();

// 1. Export endpoints (Must be declared before parameterized /:id routes)
router.get('/export', requireAuth, requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM', 'FACULTY'), exportEvents);
router.get('/:id/attendance/export', requireAuth, requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM', 'FACULTY'), exportEventAttendance);

// 2. Events General
router.get('/', requireAuth, listEvents);
router.get('/:id', requireAuth, getEventById);
router.post('/', requireAuth, requireRole('ADMIN'), createEvent);
router.patch('/:id', requireAuth, requireRole('ADMIN'), updateEvent);

// 3. Self Registration
router.post('/:id/register', requireAuth, registerForEvent);
router.get('/:id/registrations', requireAuth, requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM', 'FACULTY'), listEventRegistrations);

// 4. Excel Participant Batch Import (ADMIN ONLY)
router.post(
  '/:id/import/preview',
  requireAuth,
  requireRole('ADMIN'),
  uploadExcel.single('file'),
  previewParticipantImport
);
router.post(
  '/:id/import/commit',
  requireAuth,
  requireRole('ADMIN'),
  commitParticipantImport
);
router.get(
  '/:id/imports',
  requireAuth,
  requireRole('ADMIN'),
  listEventImports
);
router.get(
  '/:id/imports/:importId/errors',
  requireAuth,
  requireRole('ADMIN'),
  downloadErrorReport
);

// 5. Attendance Management (Admin + Volunteer)
router.get(
  '/:id/attendance',
  requireAuth,
  requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM', 'FACULTY'),
  listEventAttendance
);
router.post(
  '/:id/attendance',
  requireAuth,
  requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM'),
  markAttendance
);
router.post(
  '/:id/attendance/correction-request',
  requireAuth,
  requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM'),
  requestAttendanceCorrection
);
router.post(
  '/:id/attendance/:attendanceId/approve-correction',
  requireAuth,
  requireRole('ADMIN'),
  approveAttendanceCorrection
);

// 6. Participation Tracking (Admin + Volunteer)
router.post(
  '/:id/participation',
  requireAuth,
  requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM'),
  recordParticipation
);

// 7. Event Credit Ledger & Bulk Awarding (Admin + Volunteer)
router.get(
  '/:id/credits',
  requireAuth,
  requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM', 'FACULTY'),
  listEventCredits
);
router.post(
  '/:id/credits/bulk',
  requireAuth,
  requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM'),
  bulkAwardCredits
);

export default router;
