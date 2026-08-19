import { Router } from 'express';
import {
  getGoodieInventory,
  updateGoodieInventory,
  listRankGoodies,
  issueRankGoodie,
  bulkIssueRankGoodies,
} from '../controllers/reward.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Screen 6: Goodie Inventory & Configuration
router.get('/goodie-inventory', requireAuth, requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'), getGoodieInventory);
router.patch('/goodie-inventory/:levelName', requireAuth, requireRole('ADMIN'), updateGoodieInventory);

// Screen 6: Entitlement Queue & Issuing
router.get('/rank-goodies', requireAuth, requireRole('ADMIN', 'EVENT_TEAM', 'FACULTY'), listRankGoodies);
router.post('/rank-goodies/:id/issue', requireAuth, requireRole('ADMIN', 'EVENT_TEAM'), issueRankGoodie);
router.post('/rank-goodies/bulk-issue', requireAuth, requireRole('ADMIN', 'EVENT_TEAM'), bulkIssueRankGoodies);

export default router;
