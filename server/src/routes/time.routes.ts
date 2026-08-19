import { Router } from 'express';
import { getServerTime } from '../controllers/time.controller';

const router = Router();

// Public server time synchronization endpoint
router.get('/', getServerTime);

export default router;
