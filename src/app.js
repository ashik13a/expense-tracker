import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimitMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

export const createApp = () => {
  const app = express();

  // Required behind reverse proxies (e.g. Render) so express-rate-limit reads client IPs correctly
  app.set('trust proxy', 1);

  const allowedOrigins = env.clientUrl
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'SpendWise Expense Tracker API is running',
      health: '/api/health',
    });
  });

  if (env.nodeEnv !== 'test') {
    app.use('/api', apiLimiter);
  }

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
