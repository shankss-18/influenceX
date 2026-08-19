import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import timeRoutes from './time.routes';
import categoryRoutes from './category.routes';
import studentRoutes from './student.routes';
import eventRoutes from './event.routes';
import creditRoutes from './credit.routes';
import creditRuleRoutes from './creditRule.routes';
import levelRoutes from './level.routes';
import leaderboardRoutes from './leaderboard.routes';
import rewardRoutes from './reward.routes';
import analyticsRoutes from './analytics.routes';
import reportRoutes from './report.routes';
import auditRoutes from './audit.routes';
import workshopRoutes from './workshop.routes';
import volunteerRoutes from './volunteer.routes';
import studentPortalRoutes from './student-portal.routes';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'InfluenceX API',
    version: '5.0.0 (Phase 5 Final)',
    timestamp: new Date().toISOString(),
  });
});

// Mount modules
router.use('/time', timeRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/event-categories', categoryRoutes);
router.use('/students', studentRoutes);
router.use('/student-portal', studentPortalRoutes);
router.use('/volunteer', volunteerRoutes);
router.use('/events', eventRoutes);
router.use('/workshops', workshopRoutes);
router.use('/credits', creditRoutes);
router.use('/credit-rules', creditRuleRoutes);
router.use('/levels', levelRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/rewards', rewardRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditRoutes);

export default router;
