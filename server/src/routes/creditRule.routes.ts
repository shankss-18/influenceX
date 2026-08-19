import { Router } from 'express';
import { listCreditRules, updateCreditRule } from '../controllers/creditRule.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/', requireAuth, listCreditRules);
router.patch('/:id', requireAuth, requireRole('ADMIN'), updateCreditRule);

export default router;
