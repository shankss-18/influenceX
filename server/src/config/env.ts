import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/influencex',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'fallback_jwt_access_secret_influencex_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback_jwt_refresh_secret_influencex_2026',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  ADMIN_NAME: process.env.ADMIN_NAME || 'System Administrator',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@influencex.niat.edu',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@123456',
  ADMIN_ROLE: process.env.ADMIN_ROLE || 'ADMIN',
  TZ: process.env.TZ || 'Asia/Kolkata',
};
