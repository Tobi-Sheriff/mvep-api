import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';

type Period = '7d' | '30d' | '90d' | '1y';

interface PeriodBounds {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

function getPeriodBounds(period: Period): PeriodBounds {
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
  productName: string;
  quantity: number;
  unitPrice: number;
}

function parseItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as OrderItem[];
}

async function getVendorId(userId: string): Promise<string> {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new NotFoundError('No vendor profile found');
  return vendor.id;
}

export async function getOverview(userId: string) {
  const vendorId = await getVendorId(userId);

  const products = await prisma.product.findMany({
    where: { vendorId },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);
  const totalProducts = productIds.length;

  // All orders containing at least one item from this vendor
  const allOrders = await prisma.order.findMany({
    where: { status: { not: 'cancelled' } },
    select: { id: true, customerId: true, items: true, createdAt: true },
  });

  const vendorOrders = allOrders.filter((o) => {
    const items = parseItems(o.items);
    return items.some((i) => productIds.includes(i.productId));
  });

  let totalRevenue = 0;
  const customerIds = new Set<string>();
  for (const o of vendorOrders) {
    const items = parseItems(o.items).filter((i) => productIds.includes(i.productId));
    for (const i of items) totalRevenue += i.unitPrice * i.quantity;
    customerIds.add(o.customerId);
  }

  // Period comparison (last 30 days vs previous 30 days)
  const { start, prevStart, prevEnd } = getPeriodBounds('30d');

  const currentOrders = vendorOrders.filter((o) => o.createdAt >= start);
  const prevOrders = vendorOrders.filter(
    (o) => o.createdAt >= prevStart && o.createdAt < prevEnd,
  );

  const currentRevenue = currentOrders.reduce((sum, o) => {
    const items = parseItems(o.items).filter((i) => productIds.includes(i.productId));
    return sum + items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  }, 0);

  const prevRevenue = prevOrders.reduce((sum, o) => {
    const items = parseItems(o.items).filter((i) => productIds.includes(i.productId));
    return sum + items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  }, 0);

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders: vendorOrders.length,
    totalProducts,
    totalCustomers: customerIds.size,
    revenueChange: pctChange(currentRevenue, prevRevenue),
    ordersChange: pctChange(currentOrders.length, prevOrders.length),
  };
}

export async function getRevenueSeries(userId: string, period: Period) {
  const vendorId = await getVendorId(userId);

  const products = await prisma.product.findMany({
    where: { vendorId },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);

  const { start, end, prevStart, prevEnd } = getPeriodBounds(period);

  const allOrders = await prisma.order.findMany({
    where: {
      status: { not: 'cancelled' },
      createdAt: { gte: start, lte: end },
    },
    select: { items: true, createdAt: true },
  });

  const vendorOrders = allOrders.filter((o) =>
    parseItems(o.items).some((i) => productIds.includes(i.productId)),
  );

  // Group by date string YYYY-MM-DD
  const byDate = new Map<string, { revenue: number; orders: number }>();
  for (const o of vendorOrders) {
    const dateKey = o.createdAt.toISOString().slice(0, 10);
    const items = parseItems(o.items).filter((i) => productIds.includes(i.productId));
    const rev = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
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

  // Previous period for change %
  const prevAllOrders = await prisma.order.findMany({
    where: {
      status: { not: 'cancelled' },
      createdAt: { gte: prevStart, lte: prevEnd },
    },
    select: { items: true },
  });
  const prevRevenue = prevAllOrders
    .filter((o) => parseItems(o.items).some((i) => productIds.includes(i.productId)))
    .reduce((sum, o) => {
      const items = parseItems(o.items).filter((i) => productIds.includes(i.productId));
      return sum + items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    }, 0);

  return {
    data,
    total: Math.round(total * 100) / 100,
    change: pctChange(total, prevRevenue),
  };
}

export async function getTopProducts(userId: string) {
  const vendorId = await getVendorId(userId);

  const products = await prisma.product.findMany({
    where: { vendorId },
    select: { id: true, name: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  const orders = await prisma.order.findMany({
    where: { status: { not: 'cancelled' } },
    select: { items: true },
  });

  const stats = new Map<string, { revenue: number; unitsSold: number }>();
  for (const o of orders) {
    const items = parseItems(o.items).filter((i) => productMap.has(i.productId));
    for (const i of items) {
      const entry = stats.get(i.productId) ?? { revenue: 0, unitsSold: 0 };
      entry.revenue += i.unitPrice * i.quantity;
      entry.unitsSold += i.quantity;
      stats.set(i.productId, entry);
    }
  }

  return Array.from(stats.entries())
    .map(([id, { revenue, unitsSold }]) => ({
      id,
      name: productMap.get(id)!,
      revenue: Math.round(revenue * 100) / 100,
      unitsSold,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}
