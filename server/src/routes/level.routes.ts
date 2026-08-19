import { Router } from 'express';
import { listLevelThresholds, updateLevelThreshold } from '../controllers/creditRule.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/', requireAuth, listLevelThresholds);
router.patch('/:id', requireAuth, requireRole('ADMIN'), updateLevelThreshold);

export default router;
