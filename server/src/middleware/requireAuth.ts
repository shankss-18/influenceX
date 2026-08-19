import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { User, IUser } from '../models/User';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token = req.cookies?.accessToken;

    // Fallback: check Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing authentication token',
      });
      return;
    }

    // Verify token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or expired authentication token',
      });
      return;
    }

    // Find active user
    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: User account no longer exists',
      });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: User account is disabled',
      });
      return;
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('[requireAuth] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during authentication verification',
    });
  }
}
