import { Request, Response } from 'express';
import { getCurrentISTDate, getCurrentISTString } from '../utils/timezone';

export function getServerTime(_req: Request, res: Response): void {
  const now = getCurrentISTDate();
  res.status(200).json({
    success: true,
    serverTimeUTC: now.toISOString(),
    serverTimeIST: getCurrentISTString(),
    timestamp: now.getTime(),
    timezone: 'Asia/Kolkata',
  });
}
