import request from 'supertest';
import { app } from '../src/app';
import { prisma, clearDatabase, createTestUser } from './helpers/testSetup';

// ─── Setup ────────────────────────────────────────────────────────────────────

let adminToken: string;
let adminUserId: string;
let vendorToken: string;
let vendorUserId: string;
let vendorId: string;
let customerToken: string;
let customerId: string;
let productId: string;
let orderId: string;

beforeAll(async () => {
  await clearDatabase();

  const admin = await createTestUser('admin');
  const vendor = await createTestUser('vendor');
  const customer = await createTestUser('customer');

  adminToken = admin.token;
  adminUserId = admin.user.id;
  vendorToken = vendor.token;
  vendorUserId = vendor.user.id;
  customerToken = customer.token;
  customerId = customer.user.id;

  const vendorRecord = await prisma.vendor.findUniqueOrThrow({ where: { userId: vendorUserId } });
  vendorId = vendorRecord.id;

  const product = await prisma.product.create({
    data: {
      name: 'Test Product',
      description: 'desc',
      price: 100,
      stock: 50,
      category: 'Electronics',
      image: 'img.jpg',
      images: ['img.jpg'],
      vendorId,
    },
  });
  productId = product.id;

  const order = await prisma.order.create({
    data: {
      customerId,
      customerName: 'Customer',
      customerEmail: 'c@test.com',
      items: [{ productId: product.id, productName: 'Test Product', quantity: 2, unitPrice: 100 }] as never,
      total: 200,
      status: 'delivered',
    },
  });
  orderId = order.id;

  // Cancelled order — should be excluded from revenue
  await prisma.order.create({
    data: {
      customerId,
      customerName: 'Customer',
      customerEmail: 'c@test.com',
      items: [{ productId: product.id, productName: 'Test Product', quantity: 1, unitPrice: 100 }] as never,
      total: 100,
      status: 'cancelled',
    },
  });
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});

// ─── GET /api/v1/admin/stats ──────────────────────────────────────────────────

describe('GET /api/v1/admin/stats', () => {
  it('1: admin token → 200 with all expected fields', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(typeof res.body.totalOrders).toBe('number');
    expect(typeof res.body.totalProducts).toBe('number');
    expect(typeof res.body.totalVendors).toBe('number');
    expect(typeof res.body.totalCustomers).toBe('number');
    expect(typeof res.body.totalUsers).toBe('number');
    expect(typeof res.body.revenueChange).toBe('number');
    expect(typeof res.body.ordersChange).toBe('number');
    expect(typeof res.body.newUsersThisMonth).toBe('number');
  });

  it('2: vendor token → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });

  it('3: customer token → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('4: no token → 401', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    expect(res.status).toBe(401);
  });

  it('5: cancelled orders excluded from revenue', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // Only 1 non-cancelled order with 2×100 = 200
    expect(res.body.totalRevenue).toBeCloseTo(200, 1);
    expect(res.body.totalOrders).toBe(1);
  });
});

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────────

describe('GET /api/v1/admin/users', () => {
  it('6: admin → 200 with users array + pagination', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
    expect(res.body.users.length).toBeGreaterThan(0);
  });

  it('7: filter by role=customer returns only customers', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?role=customer')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const u of res.body.users) {
      expect(u.role).toBe('customer');
    }
  });

  it('8: search by name returns matching users', async () => {
    const allRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const firstName: string = allRes.body.users[0].name.split(' ')[0];

    const res = await request(app)
      .get(`/api/v1/admin/users?search=${encodeURIComponent(firstName)}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThan(0);
  });

  it('9: non-admin → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/v1/admin/users/:id ─────────────────────────────────────────────

describe('GET /api/v1/admin/users/:id', () => {
  it('10: returns user by id', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(customerId);
    expect(res.body.role).toBe('customer');
  });

  it('11: non-existent id → 404', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users/nonexistent-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/admin/users/:id/status ────────────────────────────────────

describe('PATCH /api/v1/admin/users/:id/status', () => {
  it('12: admin can suspend another user', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${customerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
  });

  it('13: restore user to active', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${customerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('14: admin cannot change own status', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${adminUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });
    expect(res.status).toBe(400);
  });

  it('15: invalid status → 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${customerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'deleted' });
    expect(res.status).toBe(400);
  });

  it('16: non-existent user → 404', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/nonexistent-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'banned' });
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/v1/admin/vendors ───────────────────────────────────────────────

describe('GET /api/v1/admin/vendors', () => {
  it('17: admin → 200 with vendors array and stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/vendors')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.vendors)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    for (const v of res.body.vendors) {
      expect(typeof v.id).toBe('string');
      expect(typeof v.storeName).toBe('string');
      expect(typeof v.productCount).toBe('number');
      expect(typeof v.totalRevenue).toBe('number');
      expect(typeof v.totalOrders).toBe('number');
    }
  });

  it('18: vendor revenue computed from non-cancelled orders', async () => {
    const res = await request(app)
      .get('/api/v1/admin/vendors')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const v = res.body.vendors.find((x: { id: string }) => x.id === vendorId);
    expect(v).toBeDefined();
    // 1 non-cancelled order: 2×100 = 200
    expect(v.totalRevenue).toBeCloseTo(200, 1);
    expect(v.totalOrders).toBe(1);
  });

  it('19: non-admin → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/vendors')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/v1/admin/orders ────────────────────────────────────────────────

describe('GET /api/v1/admin/orders', () => {
  it('20: admin → 200 with orders array and total', async () => {
    const res = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('21: filter by status=delivered returns only delivered orders', async () => {
    const res = await request(app)
      .get('/api/v1/admin/orders?status=delivered')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const o of res.body.orders) {
      expect(o.status).toBe('delivered');
    }
  });

  it('22: filter by customerId returns that customer\'s orders', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/orders?customerId=${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const o of res.body.orders) {
      expect(o.customerId).toBe(customerId);
    }
  });

  it('23: filter by vendorId returns orders containing that vendor\'s products', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/orders?vendorId=${vendorId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
  });

  it('24: non-admin → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/v1/admin/analytics/revenue ─────────────────────────────────────

describe('GET /api/v1/admin/analytics/revenue', () => {
  it('25: period=30d → 200 { data, total, change }', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/revenue?period=30d')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.change).toBe('number');
  });

  it('26: data points have date, revenue, orders fields', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/revenue?period=30d')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const point of res.body.data) {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('revenue');
      expect(point).toHaveProperty('orders');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(point.date)).toBe(true);
    }
  });

  it('27: invalid period → 400', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/revenue?period=3d')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('28: non-admin → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/revenue?period=7d')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});
