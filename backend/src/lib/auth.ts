import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// In production a real secret MUST be set — never silently fall back to a
// public default (that would let anyone forge admin tokens). Locally, a dev
// placeholder is fine.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

// Make `req.provisionerId` a first-class, typed property set by requireAuth.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      provisionerId?: string;
    }
  }
}

export function signToken(provisionerId: string): string {
  return jwt.sign({ sub: provisionerId }, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
    req.provisionerId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
