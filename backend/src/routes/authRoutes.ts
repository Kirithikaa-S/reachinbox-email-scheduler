import { Router, Request, Response } from 'express';
import passport from '../auth/passport';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../auth/jwt';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/errorHandler';
import type { User } from '@prisma/client';

const router = Router();

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=oauth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as User;
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
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
