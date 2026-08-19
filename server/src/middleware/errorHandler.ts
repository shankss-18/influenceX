import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error Handler]:', err);

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Handle MongoDB Duplicate Key (e.g. unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    res.status(409).json({
      success: false,
      error: `Duplicate value entered for ${field}. A user with this ${field} already exists.`,
    });
    return;
  }

  // Default internal server error
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred',
  });
}
