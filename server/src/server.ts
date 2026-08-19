import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { connectDB } from './config/db';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { initializeScheduledJobs } from './utils/cron';
import './config/timezone'; // Initialize timezone

const app = express();

// Trust proxy for secure cookies and accurate client IP in audit logs
app.set('trust proxy', 1);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        origin === env.CLIENT_URL ||
        origin.endsWith('.vercel.app')
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging in development
if (env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
  });
}

// Mount API routes
app.use('/api', apiRoutes);

// 404 handler for API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found',
  });
});

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  await connectDB();
  initializeScheduledJobs();
  app.listen(env.PORT, () => {
    console.log('====================================================');
    console.log(` InfluenceX Backend API running on port ${env.PORT}`);
    console.log(` Environment: ${env.NODE_ENV}`);
    console.log(` Timezone:    ${env.TZ}`);
    console.log(` Client URL:  ${env.CLIENT_URL}`);
    console.log('====================================================');
  });
}

startServer();

export default app;
