import { Router } from 'express';
import { requireAuth } from '../auth/jwt';
import { asyncHandler } from '../middleware/errorHandler';
import { env } from '../config/env';
import {
  buildSlackAuthorizeUrl,
  exchangeSlackCode,
  connectSlackForUser,
  disconnectSlackForUser,
  getSlackStatus,
} from '../slack/slackService';
import { AppError } from '../utils/AppError';

const router = Router();

// GET /api/slack/connect - starts OAuth, must be authenticated
router.get(
  '/connect',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Encode the user id into `state` so the callback (which Slack calls
    // without our cookies necessarily round-tripping in all browsers) can
    // still identify who is connecting.
    const state = Buffer.from(JSON.stringify({ userId: req.userId })).toString('base64url');
    res.redirect(buildSlackAuthorizeUrl(state));
  })
);

// GET /api/slack/callback - Slack redirects here after user authorizes
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) throw new AppError('Missing code/state from Slack', 400);

    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      userId = decoded.userId;
    } catch {
      throw new AppError('Invalid Slack OAuth state', 400);
    }

    const tokenData = await exchangeSlackCode(code);
    await connectSlackForUser(userId, tokenData);

    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  })
);

// POST /api/slack/disconnect
router.post(
  '/disconnect',
  requireAuth,
  asyncHandler(async (req, res) => {
    await disconnectSlackForUser(req.userId!);
    res.json({ success: true, data: { disconnected: true } });
  })
);

// GET /api/slack/status
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = await getSlackStatus(req.userId!);
    res.json({ success: true, data: status });
  })
);

export default router;
