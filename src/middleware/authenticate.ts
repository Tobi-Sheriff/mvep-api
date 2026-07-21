import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { UnauthorisedError, ForbiddenError } from '../lib/errors';
import { UserRole } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

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

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorisedError('Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.slice(7);

  let sub: string;
  try {
    sub = verifyToken(token).sub;
  } catch {
    next(new UnauthorisedError('Invalid or expired token'));
    return;
  }

  // Re-check the account on every request so a token issued before a ban/suspension
  // (or a role change) can't keep working until it naturally expires.
  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, role: true, status: true },
  });

  if (!user) {
    next(new UnauthorisedError('Invalid or expired token'));
    return;
  }
  if (user.status === 'suspended') {
    next(new ForbiddenError('Account suspended'));
    return;
  }
  if (user.status === 'banned') {
    next(new ForbiddenError('Account banned'));
    return;
  }

  req.user = { id: user.id, role: user.role };
  next();
}
