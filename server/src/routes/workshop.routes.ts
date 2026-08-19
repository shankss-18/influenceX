import { Router } from 'express';
import {
  listWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  purgeAllWorkshops,
  getWorkshopSetupData,
  previewVolunteersUpload,
  assignVolunteersToHalls,
  generateVolunteerCredentials,
  reassignVolunteerHall,
  previewStudentsAutoAssign,
  commitStudentsPlacement,
  getWorkshopConsoleData,
  adminOverrideAttendance,
  adminAssignParticipationCredit,
  reassignStudentHall,
  endWorkshop,
  revokeRegistrationCredits,
} from '../controllers/workshop.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { uploadExcel } from '../utils/multer';

const router = Router();

// Screen 1: List workshops
router.get('/', requireAuth, requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM'), listWorkshops);

// Screen 2: Create, Update & Delete workshop (Admin only)
router.post('/', requireAuth, requireRole('ADMIN'), createWorkshop);
router.delete('/purge/all', requireAuth, requireRole('ADMIN'), purgeAllWorkshops);
router.patch('/:id', requireAuth, requireRole('ADMIN'), updateWorkshop);
router.delete('/:id', requireAuth, requireRole('ADMIN'), deleteWorkshop);
router.post('/:id/revoke-registration-credits', requireAuth, requireRole('ADMIN'), revokeRegistrationCredits);

// Screen 3: Workshop Setup (Volunteers & Students)
router.get('/:id/setup', requireAuth, requireRole('ADMIN'), getWorkshopSetupData);
router.post(
  '/:id/setup/volunteers/preview',
  requireAuth,
  requireRole('ADMIN'),
  uploadExcel.single('file'),
  previewVolunteersUpload
);
router.post('/:id/setup/volunteers/assign', requireAuth, requireRole('ADMIN'), assignVolunteersToHalls);
router.post('/:id/setup/volunteers/credentials', requireAuth, requireRole('ADMIN'), generateVolunteerCredentials);
router.post('/:id/setup/volunteers/reassign', requireAuth, requireRole('ADMIN'), reassignVolunteerHall);

router.post(
  '/:id/setup/students/preview',
  requireAuth,
  requireRole('ADMIN'),
  uploadExcel.single('file'),
  previewStudentsAutoAssign
);
router.post('/:id/setup/students/commit', requireAuth, requireRole('ADMIN'), commitStudentsPlacement);

// Screen 4: Workshop Console (Live Manage)
router.get('/:id/console', requireAuth, requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM'), getWorkshopConsoleData);
router.post('/:id/console/attendance', requireAuth, requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM'), adminOverrideAttendance);
router.post('/:id/console/credits', requireAuth, requireRole('ADMIN', 'VOLUNTEER', 'EVENT_TEAM'), adminAssignParticipationCredit);
router.post('/:id/console/reassign-student', requireAuth, requireRole('ADMIN'), reassignStudentHall);
router.post('/:id/console/reassign-volunteer', requireAuth, requireRole('ADMIN'), reassignVolunteerHall);
router.post('/:id/console/end', requireAuth, requireRole('ADMIN'), endWorkshop);

export default router;
