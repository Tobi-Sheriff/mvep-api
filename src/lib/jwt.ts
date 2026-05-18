import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET);
  return decoded as JwtPayload;
}
