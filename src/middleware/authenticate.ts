import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { UnauthorisedError } from '../lib/errors';
import { UserRole } from '../generated/prisma/client';

export interface AuthUser {
  id: string;
  role: UserRole;
}

// Augment Express Request globally so req.user is available everywhere
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorisedError('Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorisedError('Invalid or expired token'));
  }
}
