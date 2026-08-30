import { Router, Request, Response } from 'express';
import passport from '../auth/passport';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../auth/jwt';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/errorHandler';
import type { User } from '@prisma/client';

const router = Router();

router.get('/google', (req: Request, res: Response, next) => {
  const returnTo = (req.query.returnTo as string) || env.FRONTEND_URL;
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url');
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
  })(req, res, next);
});

router.get(
  '/google/callback',
  (req: Request, res: Response, next) => {
    let returnTo = env.FRONTEND_URL;
    if (req.query.state) {
      try {
        const decoded = JSON.parse(
          Buffer.from(req.query.state as string, 'base64url').toString('utf-8')
        );
        if (decoded.returnTo) returnTo = decoded.returnTo;
      } catch {}
    }

    passport.authenticate('google', {
      session: false,
      failureRedirect: `${returnTo}/login?error=oauth_failed`,
    })(req, res, (err?: unknown) => {
      if (err) return next(err);
      const user = req.user as User;
      const token = signToken(user.id);
      setAuthCookie(res, token);
      res.redirect(`${returnTo}/dashboard`);
    });
  }
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    });
  })
);

router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true, data: { loggedOut: true } });
});

export default router;
