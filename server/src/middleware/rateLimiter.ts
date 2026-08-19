import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Generous limit in development
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Do not count successful logins
  skip: (req) => {
    // Skip rate limiting on local development
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip.includes('127.0.0.1') || ip.includes('::1') || process.env.NODE_ENV !== 'production';
  },
  message: {
    error: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down and try again.',
  },
});
