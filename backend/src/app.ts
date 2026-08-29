import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import slackRoutes from './routes/slackRoutes';
import senderRoutes from './routes/senderRoutes';
import healthRoutes from './routes/healthRoutes';
import { createBullBoardRouter } from './queues/bullBoard';
import { bullBoardAuth } from './middleware/basicAuth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import './auth/passport';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate-limit auth endpoints to slow brute-force/abuse.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth', authLimiter);

  app.use('/admin/queues', bullBoardAuth, createBullBoardRouter());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/senders', senderRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
