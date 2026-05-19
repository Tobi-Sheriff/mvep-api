import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import type { UpdateProfileBody } from './users.schema';

function toProfile(u: { id: string; name: string; email: string; role: string; avatar: string | null }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');
  return toProfile(user);
}

export async function updateProfile(userId: string, body: UpdateProfileBody) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: body.name,
      ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
    },
  });
  return toProfile(user);
}

export async function getWishlist(userId: string): Promise<string[]> {
  const entries = await prisma.wishlist.findMany({
    where: { userId },
    select: { productId: true },
    orderBy: { createdAt: 'asc' },
  });
  return entries.map((e) => e.productId);
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  await prisma.wishlist.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });

  return { productId, added: true };
}

export async function removeFromWishlist(userId: string, productId: string) {
  await prisma.wishlist
    .delete({ where: { userId_productId: { userId, productId } } })
    .catch(() => {
      // Silent if not in wishlist — idempotent
    });

  return { productId, removed: true };
}
