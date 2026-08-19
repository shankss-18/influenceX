import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Response } from 'express';
import { env } from '../config/env';
import { IUser, UserRole } from '../models/User';

export interface TokenPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Token generation
export function generateTokens(user: IUser): GeneratedTokens {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });

  return { accessToken, refreshToken };
}

// Verify tokens
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

// Cookie configuration
const isProd = env.NODE_ENV === 'production';

export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
};

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export function setAuthCookies(res: Response, tokens: GeneratedTokens): void {
  res.cookie('accessToken', tokens.accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('accessToken', {
    ...ACCESS_COOKIE_OPTIONS,
    maxAge: 0,
  });
  res.clearCookie('refreshToken', {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
