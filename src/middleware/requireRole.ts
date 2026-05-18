import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../lib/errors';
import { UserRole } from '../generated/prisma/client';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
