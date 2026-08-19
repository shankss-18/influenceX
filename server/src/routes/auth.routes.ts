import { Router } from 'express';
import { login, refreshToken, logout, getMe, changeFirstLoginPassword, changePassword } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/requireAuth';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public auth endpoints with rate limiting
router.post('/login', authRateLimiter, login);
router.post('/refresh', authRateLimiter, refreshToken);
router.post('/logout', logout);

// Authenticated session check & password resets
router.get('/me', requireAuth, getMe);
router.post('/change-password-first-login', requireAuth, changeFirstLoginPassword);
router.post('/change-password', requireAuth, changePassword);

export default router;
