import { Request, Response } from 'express';
import * as authService from './auth.service';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
} from './auth.schema';

export async function register(req: Request, res: Response): Promise<void> {
  const body = registerSchema.parse(req.body);
  const result = await authService.register(body);
  res.status(201).json(result);
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const body = verifyEmailSchema.parse(req.body);
  const result = await authService.verifyEmail(body);
  res.status(200).json(result);
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  const body = resendVerificationSchema.parse(req.body);
  const result = await authService.resendVerification(body.email);
  res.status(200).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  const result = await authService.login(body);
  res.status(200).json(result);
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ message: 'Logged out successfully' });
}

export async function me(req: Request, res: Response): Promise<void> {
  const result = await authService.me(req.user!.id);
  res.status(200).json(result);
}
