import request from 'supertest';
import { app } from '../src/app';
import { prisma, clearDatabase, createTestUser } from './helpers/testSetup';

// ─── Setup ────────────────────────────────────────────────────────────────────

let vendorToken: string;
let vendorUserId: string;
let vendorId: string;
let customerToken: string;
let customerId: string;

beforeAll(async () => {
  await clearDatabase();

  const vendor = await createTestUser('vendor');
  const customer = await createTestUser('customer');

  vendorToken = vendor.token;
  vendorUserId = vendor.user.id;
  customerToken = customer.token;
  customerId = customer.user.id;

  const vendorRecord = await prisma.vendor.findUniqueOrThrow({
    where: { userId: vendorUserId },
  });
  vendorId = vendorRecord.id;

  // Seed 3 products for this vendor
  const [p1, p2, p3] = await Promise.all([
    prisma.product.create({
      data: { name: 'Alpha', description: 'd', price: 100, stock: 50, category: 'Electronics', image: 'a.jpg', images: ['a.jpg'], vendorId },
    }),
    prisma.product.create({
      data: { name: 'Beta', description: 'd', price: 50, stock: 50, category: 'Electronics', image: 'b.jpg', images: ['b.jpg'], vendorId },
    }),
    prisma.product.create({
      data: { name: 'Gamma', description: 'd', price: 25, stock: 50, category: 'Electronics', image: 'g.jpg', images: ['g.jpg'], vendorId },
    }),
  ]);

  // Seed 3 orders (non-cancelled) containing vendor products
  const orderItems = (items: { productId: string; productName: string; quantity: number; unitPrice: number }[]) =>
    items as never;

  await Promise.all([
    prisma.order.create({
      data: {
        customerId,
        customerName: 'Customer',
        customerEmail: 'c@test.com',
        items: orderItems([{ productId: p1.id, productName: 'Alpha', quantity: 2, unitPrice: 100 }]),
        total: 200,
        status: 'delivered',
      },
    }),
    prisma.order.create({
      data: {
        customerId,
        customerName: 'Customer',
        customerEmail: 'c@test.com',
        items: orderItems([
          { productId: p2.id, productName: 'Beta', quantity: 3, unitPrice: 50 },
          { productId: p3.id, productName: 'Gamma', quantity: 1, unitPrice: 25 },
        ]),
        total: 175,
        status: 'shipped',
      },
    }),
    prisma.order.create({
      data: {
        customerId,
        customerName: 'Customer',
        customerEmail: 'c@test.com',
        items: orderItems([{ productId: p1.id, productName: 'Alpha', quantity: 1, unitPrice: 100 }]),
        total: 100,
        status: 'cancelled', // should be excluded
      },
    }),
  ]);
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});

// ─── GET /api/v1/analytics/overview ──────────────────────────────────────────

describe('GET /api/v1/analytics/overview', () => {
  it('1: vendor token → 200 with all 6 fields, non-negative numbers', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(typeof res.body.totalOrders).toBe('number');
    expect(typeof res.body.totalProducts).toBe('number');
    expect(typeof res.body.totalCustomers).toBe('number');
    expect(typeof res.body.revenueChange).toBe('number');
    expect(typeof res.body.ordersChange).toBe('number');
    expect(res.body.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(res.body.totalOrders).toBeGreaterThanOrEqual(0);
  });

  it('2: customer token → 403', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('3: cancelled orders excluded from revenue', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    // 2 non-cancelled orders: 200 + 175 = 375
    expect(res.body.totalRevenue).toBeCloseTo(375, 1);
    expect(res.body.totalOrders).toBe(2);
  });
});

// ─── GET /api/v1/analytics/revenue ───────────────────────────────────────────

describe('GET /api/v1/analytics/revenue', () => {
  it('4: period=7d → 200 { data, total, change }', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?period=7d')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.change).toBe('number');
  });

  it('5: period=30d → data points each have date, revenue, orders', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?period=30d')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    for (const point of res.body.data) {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('revenue');
      expect(point).toHaveProperty('orders');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(point.date)).toBe(true);
    }
  });

  it('6: period=90d → 200', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?period=90d')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
  });

  it('7: period=1y → 200', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?period=1y')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
  });

  it('8: invalid period → 400', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?period=3d')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(400);
  });

  it('9: total equals sum of data[].revenue', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?period=30d')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    const sum = res.body.data.reduce((s: number, d: { revenue: number }) => s + d.revenue, 0);
    expect(res.body.total).toBeCloseTo(sum, 2);
  });

  it('10: change field is a number', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?period=7d')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.change).toBe('number');
  });
});

// ─── GET /api/v1/analytics/products/top ──────────────────────────────────────

describe('GET /api/v1/analytics/products/top', () => {
  it('9: returns ≤5 products each with id, name, revenue, unitsSold', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/products/top')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(5);
    for (const item of res.body) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(typeof item.revenue).toBe('number');
      expect(typeof item.unitsSold).toBe('number');
    }
  });

  it('10: sorted by revenue DESC', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/products/top')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    const revenues = res.body.map((p: { revenue: number }) => p.revenue);
    for (let i = 1; i < revenues.length; i++) {
      expect(revenues[i]).toBeLessThanOrEqual(revenues[i - 1]);
    }
    // Alpha has 200 (2×100) in revenue → should be first
    if (res.body.length > 0) {
      expect(res.body[0].name).toBe('Alpha');
    }
  });
});
