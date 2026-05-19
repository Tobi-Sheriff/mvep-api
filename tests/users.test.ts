import request from 'supertest';
import { app } from '../src/app';
import { prisma, clearDatabase, createTestUser } from './helpers/testSetup';

// ─── Setup ────────────────────────────────────────────────────────────────────

let customerToken: string;
let customerId: string;
let vendorToken: string;
let productId: string;

beforeAll(async () => {
  await clearDatabase();

  const customer = await createTestUser('customer');
  const vendor = await createTestUser('vendor');

  customerToken = customer.token;
  customerId = customer.user.id;
  vendorToken = vendor.token;

  const vendorRecord = await prisma.vendor.findUniqueOrThrow({
    where: { userId: vendor.user.id },
  });

  const product = await prisma.product.create({
    data: {
      name: 'Wishlist Test Product',
      description: 'For wishlist tests',
      price: 10.00,
      stock: 50,
      category: 'Electronics',
      image: 'p.jpg',
      images: ['p.jpg'],
      vendorId: vendorRecord.id,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});

// ─── GET /api/v1/users/profile ────────────────────────────────────────────────

describe('GET /api/v1/users/profile', () => {
  it('1: authenticated → returns profile shape', async () => {
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(customerId);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('role');
    expect(res.body).toHaveProperty('avatar');
    expect(res.body).not.toHaveProperty('password');
  });

  it('2: no token → 401', async () => {
    const res = await request(app).get('/api/v1/users/profile');
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/v1/users/profile ────────────────────────────────────────────────

describe('PUT /api/v1/users/profile', () => {
  it('3: update name → 200 with updated name', async () => {
    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.id).toBe(customerId);
  });

  it('4: update avatar → 200 with updated avatar', async () => {
    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'New Name', avatar: 'https://example.com/avatar.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.avatar).toBe('https://example.com/avatar.jpg');
  });

  it('5: email in body is ignored (not changed)', async () => {
    const profileBefore = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${customerToken}`);
    const originalEmail = profileBefore.body.email;

    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'New Name', email: 'hacker@evil.com' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(originalEmail);
  });

  it('6: role in body is ignored (not changed)', async () => {
    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'New Name', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('customer');
  });

  it('7: empty name → 400 validation error', async () => {
    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('name');
  });
});

// ─── GET /api/v1/users/wishlist ───────────────────────────────────────────────

describe('GET /api/v1/users/wishlist', () => {
  beforeAll(async () => {
    await prisma.wishlist.create({ data: { userId: customerId, productId } });
  });

  it('8: customer with items → returns productId array', async () => {
    const res = await request(app)
      .get('/api/v1/users/wishlist')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain(productId);
  });

  it('9: customer with empty wishlist → returns []', async () => {
    const other = await createTestUser('customer');
    const res = await request(app)
      .get('/api/v1/users/wishlist')
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('10: vendor token → 403', async () => {
    const res = await request(app)
      .get('/api/v1/users/wishlist')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/v1/users/wishlist/:productId ───────────────────────────────────

describe('POST /api/v1/users/wishlist/:productId', () => {
  it('11: add new product → 200 { productId, added: true }', async () => {
    const other = await createTestUser('customer');
    const res = await request(app)
      .post(`/api/v1/users/wishlist/${productId}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(200);
    expect(res.body.productId).toBe(productId);
    expect(res.body.added).toBe(true);
  });

  it('12: add duplicate (idempotent) → 200, no error', async () => {
    const res = await request(app)
      .post(`/api/v1/users/wishlist/${productId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(true);

    // No duplicate rows
    const count = await prisma.wishlist.count({ where: { userId: customerId, productId } });
    expect(count).toBe(1);
  });

  it('13: unknown product → 404', async () => {
    const res = await request(app)
      .post('/api/v1/users/wishlist/nonexistent-id')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });

  it('14: vendor token → 403', async () => {
    const res = await request(app)
      .post(`/api/v1/users/wishlist/${productId}`)
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/v1/users/wishlist/:productId ─────────────────────────────────

describe('DELETE /api/v1/users/wishlist/:productId', () => {
  it('15: remove existing item → 200 { productId, removed: true }', async () => {
    await prisma.wishlist.upsert({
      where: { userId_productId: { userId: customerId, productId } },
      create: { userId: customerId, productId },
      update: {},
    });
    const res = await request(app)
      .delete(`/api/v1/users/wishlist/${productId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.productId).toBe(productId);
    expect(res.body.removed).toBe(true);
  });

  it('16: remove non-existent → 200 (silent / idempotent)', async () => {
    const res = await request(app)
      .delete('/api/v1/users/wishlist/nonexistent-id')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);
  });

  it('17: vendor token → 403', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/wishlist/${productId}`)
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});
