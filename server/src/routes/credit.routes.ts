import { Router } from 'express';
import {
  listGlobalLedger,
  awardSingleCredit,
  approveCreditTransaction,
} from '../controllers/credit.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/ledger', requireAuth, requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'), listGlobalLedger);
router.post('/award', requireAuth, requireRole('ADMIN', 'EVENT_TEAM'), awardSingleCredit);
router.post('/:transactionId/approve', requireAuth, requireRole('ADMIN'), approveCreditTransaction);

export default router;
