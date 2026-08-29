import { Request, Response, NextFunction } from 'express';

/**
 * Minimal HTTP Basic Auth guard for the Bull Board admin dashboard.
 * Credentials come from env vars; if not configured, defaults to
 * admin/admin for local development (documented in README).
 */
export function bullBoardAuth(req: Request, res: Response, next: NextFunction): void {
  const user = process.env.BULL_BOARD_USER || 'admin';
  const pass = process.env.BULL_BOARD_PASSWORD || 'admin';

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
    res.status(401).send('Authentication required');
    return;
  }

  const decoded = Buffer.from(header.split(' ')[1], 'base64').toString('utf-8');
  const [reqUser, reqPass] = decoded.split(':');

  if (reqUser === user && reqPass === pass) {
    next();
    return;
  }

  res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
  res.status(401).send('Invalid credentials');
}
