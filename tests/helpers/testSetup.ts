import { randomUUID } from 'crypto';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/lib/hash';
import { signToken } from '../../src/lib/jwt';
import type { UserRole } from '../../src/generated/prisma/client';

export { prisma };

const TEST_PASSWORD = 'TestPassword123!';

export async function clearDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "VerificationCode", "Wishlist", "Review", "Order", "Product", "Vendor", "User" RESTART IDENTITY CASCADE`,
  );
}

export async function createTestUser(role: 'customer' | 'vendor' | 'admin') {
  const email = `${randomUUID()}@test.com`;
  const password = await hashPassword(TEST_PASSWORD);

  const user = await prisma.user.create({
    data: {
      name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      email,
      password,
      role: role as UserRole,
      isVerified: true,
      status: 'active',
    },
  });

  if (role === 'vendor') {
    await prisma.vendor.create({
      data: {
        userId: user.id,
        storeName: `${user.name}'s Store`,
      },
    });
  }

  const token = signToken({ sub: user.id, role: user.role });
  return { user, token, password: TEST_PASSWORD };
}
