import { Router } from 'express';
import { createUser, listUsers } from '../controllers/user.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Protected admin routes
router.post('/', requireAuth, requireRole('ADMIN'), createUser);
router.get('/', requireAuth, requireRole('ADMIN'), listUsers);

export default router;
