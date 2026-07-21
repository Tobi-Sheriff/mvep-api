import { randomBytes, randomInt } from 'crypto';
import { prisma } from '../../lib/prisma';
import { hashPassword, comparePassword } from '../../lib/hash';
import { signToken } from '../../lib/jwt';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../lib/email';
import { config } from '../../config';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorisedError,
} from '../../lib/errors';
import type { RegisterBody, VerifyEmailBody, LoginBody, ResetPasswordBody } from './auth.schema';

interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}

function toUserResponse(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}): UserResponse {
  return { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar };
}

function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

export async function register(data: RegisterBody) {
  if (data.role === 'admin') {
    throw new BadRequestError('Cannot self-register as admin');
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ConflictError('Email already in use');

  const password = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password,
      role: data.role,
    },
  });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.verificationCode.upsert({
    where: { email: user.email },
    create: { email: user.email, code, expiresAt },
    update: { code, expiresAt },
  });

  await sendVerificationEmail(user.email, code);

  const base = { requiresVerification: true as const, email: user.email };
  return config.NODE_ENV !== 'production' ? { ...base, devCode: code } : base;
}

export async function verifyEmail(data: VerifyEmailBody) {
  const vc = await prisma.verificationCode.findUnique({ where: { email: data.email } });
  if (!vc) throw new NotFoundError('Email not found');

  if (vc.code !== data.code || vc.expiresAt < new Date()) {
    throw new BadRequestError('Invalid or expired verification code');
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { email: data.email },
      data: { isVerified: true },
    });
    await tx.verificationCode.delete({ where: { email: data.email } });
    if (updated.role === 'vendor') {
      await tx.vendor.upsert({
        where: { userId: updated.id },
        create: { userId: updated.id, storeName: updated.name },
        update: {},
      });
    }
    return updated;
  });

  const token = signToken({ sub: user.id, role: user.role });
  return { user: toUserResponse(user), token };
}

export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new NotFoundError('Email not found');

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.verificationCode.upsert({
    where: { email },
    create: { email, code, expiresAt },
    update: { code, expiresAt },
  });

  await sendVerificationEmail(email, code);
  return { message: 'Verification email sent' };
}

export async function login(data: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new UnauthorisedError('Invalid email or password');

  const valid = await comparePassword(data.password, user.password);
  if (!valid) throw new UnauthorisedError('Invalid email or password');

  if (!user.isVerified) throw new ForbiddenError('Please verify your email before logging in');
  if (user.status === 'suspended') throw new ForbiddenError('Account suspended');
  if (user.status === 'banned') throw new ForbiddenError('Account banned');

  const token = signToken({ sub: user.id, role: user.role });
  return { user: toUserResponse(user), token };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return the same response whether or not the email is registered —
  // this is the one auth endpoint where user enumeration is worth closing off,
  // since it's the classic target for "which emails have accounts here" probing.
  if (user) {
    await prisma.passwordResetToken.deleteMany({ where: { email } });
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { token, email, expiresAt } });
    await sendPasswordResetEmail(email, token);
  }

  return { message: 'If an account exists for that email, a reset link has been sent.' };
}

export async function resetPassword(data: ResetPasswordBody) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token: data.token } });
  if (!record || record.expiresAt < new Date()) {
    throw new BadRequestError('Invalid or expired reset token');
  }

  const password = await hashPassword(data.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { email: record.email }, data: { password } }),
    prisma.passwordResetToken.delete({ where: { token: data.token } }),
  ]);

  return { message: 'Password reset successful' };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');
  return { user: toUserResponse(user) };
}
