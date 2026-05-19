import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import type {
  ListUsersQuery,
  UpdateUserStatusBody,
  ListVendorsQuery,
  ListAdminOrdersQuery,
} from './admin.schema';

type Period = '7d' | '30d' | '90d' | '1y';
type DecimalLike = { toString(): string };

function toOrderResponse(order: {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: unknown;
  status: string;
  total: DecimalLike;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    items: order.items,
    status: order.status,
    total: parseFloat(order.total.toString()),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function getPeriodBounds(period: Period) {
  const end = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
  const ms = days * 24 * 60 * 60 * 1000;
  const start = new Date(end.getTime() - ms);
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(prevEnd.getTime() - ms);
  return { start, end, prevStart, prevEnd };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

interface OrderItem {
  productId: string;
  unitPrice: number;
  quantity: number;
}

function parseItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as OrderItem[];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getPlatformStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const { start: periodStart, prevStart, prevEnd } = getPeriodBounds('30d');

  const [
    totalUsers,
    totalOrders,
    totalProducts,
    totalVendors,
    newUsersThisMonth,
    allOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.order.count({ where: { status: { not: 'cancelled' } } }),
    prisma.product.count(),
    prisma.vendor.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.order.findMany({
      where: { status: { not: 'cancelled' } },
      select: { items: true, customerId: true, createdAt: true },
    }),
  ]);

  const totalCustomers = await prisma.user.count({ where: { role: 'customer' } });

  let totalRevenue = 0;
  let currentRevenue = 0;
  let prevRevenue = 0;
  let currentOrderCount = 0;
  let prevOrderCount = 0;

  for (const o of allOrders) {
    const rev = parseItems(o.items).reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    totalRevenue += rev;
    if (o.createdAt >= periodStart) {
      currentRevenue += rev;
      currentOrderCount++;
    }
    if (o.createdAt >= prevStart && o.createdAt < prevEnd) {
      prevRevenue += rev;
      prevOrderCount++;
    }
  }

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders,
    totalProducts,
    totalVendors,
    totalCustomers,
    totalUsers,
    revenueChange: pctChange(currentRevenue, prevRevenue),
    ordersChange: pctChange(currentOrderCount, prevOrderCount),
    newUsersThisMonth,
  };
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(filters: ListUsersQuery) {
  const { role, status, search, page, limit } = filters;

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search?.trim()) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: where as never,
      select: {
        id: true, name: true, email: true, role: true,
        status: true, isVerified: true, avatar: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where: where as never }),
  ]);

  return {
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true,
      status: true, isVerified: true, avatar: true, createdAt: true,
    },
  });
  if (!user) throw new NotFoundError('User not found');
  return { ...user, createdAt: user.createdAt.toISOString() };
}

export async function updateUserStatus(
  targetId: string,
  body: UpdateUserStatusBody,
  requestingAdminId: string,
) {
  if (targetId === requestingAdminId) {
    throw new BadRequestError('Cannot change your own status');
  }

  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw new NotFoundError('User not found');

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { status: body.status },
    select: { id: true, status: true, updatedAt: true },
  });

  return { id: updated.id, status: updated.status, updatedAt: updated.updatedAt.toISOString() };
}

// ─── Vendors ──────────────────────────────────────────────────────────────────

export async function listVendors(filters: ListVendorsQuery) {
  const { search, page, limit } = filters;

  const vendors = await prisma.vendor.findMany({
    where: search?.trim()
      ? {
          OR: [
            { storeName: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    include: {
      user: { select: { status: true } },
      products: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.vendor.count({
    where: search?.trim()
      ? {
          OR: [
            { storeName: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : undefined,
  });

  // Aggregate order revenue per vendor from order items
  const allOrders = await prisma.order.findMany({
    where: { status: { not: 'cancelled' } },
    select: { items: true },
  });

  const vendorProductIds = new Map<string, Set<string>>();
  for (const v of vendors) {
    vendorProductIds.set(v.id, new Set(v.products.map((p) => p.id)));
  }

  const vendorStats = new Map<string, { revenue: number; orders: number }>();
  for (const o of allOrders) {
    const items = parseItems(o.items);
    const touched = new Set<string>();
    for (const item of items) {
      for (const [vid, pids] of vendorProductIds) {
        if (pids.has(item.productId)) {
          const s = vendorStats.get(vid) ?? { revenue: 0, orders: 0 };
          s.revenue += item.unitPrice * item.quantity;
          if (!touched.has(vid)) {
            s.orders++;
            touched.add(vid);
          }
          vendorStats.set(vid, s);
        }
      }
    }
  }

  return {
    vendors: vendors.map((v) => {
      const stats = vendorStats.get(v.id) ?? { revenue: 0, orders: 0 };
      return {
        id: v.id,
        userId: v.userId,
        storeName: v.storeName,
        userStatus: v.user.status,
        productCount: v.products.length,
        totalRevenue: Math.round(stats.revenue * 100) / 100,
        totalOrders: stats.orders,
        createdAt: v.createdAt.toISOString(),
      };
    }),
    total,
  };
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function listAllOrders(filters: ListAdminOrdersQuery) {
  const { status, vendorId, customerId, page, limit } = filters;

  let where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  // vendorId filter: find all product IDs for that vendor, then filter orders containing them
  if (vendorId) {
    const products = await prisma.product.findMany({
      where: { vendorId },
      select: { id: true },
    });
    const pids = products.map((p) => p.id);
    // We'll filter in JS after fetching since items is Json
    const orders = await prisma.order.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
    });
    const filtered = orders.filter((o) => {
      const items = parseItems(o.items);
      return items.some((i) => pids.includes(i.productId));
    });
    const paginated = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);
    return { orders: paginated.map(toOrderResponse), total: filtered.length };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where: where as never }),
  ]);

  return { orders: orders.map(toOrderResponse), total };
}

// ─── Platform analytics ───────────────────────────────────────────────────────

export async function getPlatformRevenueSeries(period: Period) {
  const { start, end, prevStart, prevEnd } = getPeriodBounds(period);

  const [currentOrders, prevOrders] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: 'cancelled' }, createdAt: { gte: start, lte: end } },
      select: { items: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { status: { not: 'cancelled' }, createdAt: { gte: prevStart, lte: prevEnd } },
      select: { items: true },
    }),
  ]);

  const byDate = new Map<string, { revenue: number; orders: number }>();
  for (const o of currentOrders) {
    const dateKey = o.createdAt.toISOString().slice(0, 10);
    const rev = parseItems(o.items).reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const entry = byDate.get(dateKey) ?? { revenue: 0, orders: 0 };
    entry.revenue += rev;
    entry.orders += 1;
    byDate.set(dateKey, entry);
  }

  const data = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { revenue, orders }]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
      orders,
    }));

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const prevRevenue = prevOrders.reduce(
    (s, o) => s + parseItems(o.items).reduce((ss, i) => ss + i.unitPrice * i.quantity, 0),
    0,
  );

  return {
    data,
    total: Math.round(total * 100) / 100,
    change: pctChange(total, prevRevenue),
  };
}
