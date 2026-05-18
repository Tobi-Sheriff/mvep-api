import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { config } from '../config';

// Prisma error codes — checked by string comparison so we don't need
// the generated client to be present at this stage.
function isPrismaError(err: unknown): err is { code: string; name: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'name' in err &&
    (err as { name: string }).name === 'PrismaClientKnownRequestError'
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.');
      errors[key] = issue.message;
    }
    res.status(400).json({ message: 'Validation failed', errors });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (isPrismaError(err)) {
    if (err.code === 'P2002') {
      res.status(409).json({ message: 'Resource already exists' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Not found' });
      return;
    }
  }

  if (config.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(500).json({ message: 'Internal server error' });
}
