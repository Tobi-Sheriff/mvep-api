import request from 'supertest';
import { app } from '../src/app';
import { prisma, clearDatabase, createTestUser } from './helpers/testSetup';
import type { OrderStatus } from '../src/generated/prisma/client';

// ─── Setup ────────────────────────────────────────────────────────────────────

let customerToken: string;
let customerId: string;
let vendorToken: string;
let vendorId: string;
let productId: string;
let adminToken: string;
let otherVendorToken: string;
let otherProductId: string;

beforeAll(async () => {
  await clearDatabase();

  const customer = await createTestUser('customer');
  const vendor = await createTestUser('vendor');
  const admin = await createTestUser('admin');
  const otherVendor = await createTestUser('vendor');

  customerToken = customer.token;
  customerId = customer.user.id;
  vendorToken = vendor.token;
  adminToken = admin.token;
  otherVendorToken = otherVendor.token;

  const vendorRecord = await prisma.vendor.findUniqueOrThrow({
    where: { userId: vendor.user.id },
  });
  vendorId = vendorRecord.id;

  const otherVendorRecord = await prisma.vendor.findUniqueOrThrow({
    where: { userId: otherVendor.user.id },
  });

  const product = await prisma.product.create({
    data: {
      name: 'Test Widget',
      description: 'A test product',
      price: 25.00,
      stock: 100,
      category: 'Electronics',
      image: 'widget.jpg',
      images: ['widget.jpg'],
      vendorId,
    },
  });
  productId = product.id;

  const otherProduct = await prisma.product.create({
    data: {
      name: 'Other Vendor Widget',
      description: 'Belongs to a different vendor',
      price: 40.00,
      stock: 50,
      category: 'Electronics',
      image: 'other-widget.jpg',
      images: ['other-widget.jpg'],
      vendorId: otherVendorRecord.id,
    },
  });
  otherProductId = otherProduct.id;
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});

// An order containing only the *other* vendor's product — used to prove the
// main `vendorToken` can't see or touch orders outside its own products.
async function createForeignOrder(status: OrderStatus = 'pending') {
  return prisma.order.create({
    data: {
      customerId,
      customerName: 'Test Customer',
      customerEmail: 'c@test.com',
      items: [
        { productId: otherProductId, productName: 'Other Vendor Widget', quantity: 1, unitPrice: 40 },
      ] as never,
      total: 40,
      status,
    },
  });
}

// ─── POST /api/v1/orders ──────────────────────────────────────────────────────

describe('POST /api/v1/orders', () => {
  it('1: happy path — returns 201 Order', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.customerId).toBe(customerId);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('2: total is calculated server-side', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 3 }] });
    expect(res.status).toBe(201);
    expect(res.body.total).toBeCloseTo(75.0, 2);
  });

  it('3: items have productName and unitPrice from DB', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 1 }] });
    expect(res.status).toBe(201);
    const item = res.body.items[0];
    expect(item.productName).toBe('Test Widget');
    expect(item.unitPrice).toBeCloseTo(25.0, 2);
    expect(item.quantity).toBe(1);
  });

  it('4: insufficient stock → 409', async () => {
    const scarceProduct = await prisma.product.create({
      data: {
        name: 'Scarce Item',
        description: 'Very limited',
        price: 10.00,
        stock: 2,
        category: 'Electronics',
        image: 'scarce.jpg',
        images: ['scarce.jpg'],
        vendorId,
      },
    });
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: scarceProduct.id, quantity: 999 }] });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  it('5: multiple items — one fails stock → 409, nothing decremented', async () => {
    const limitedProduct = await prisma.product.create({
      data: {
        name: 'Limited Item',
        description: 'Limited stock',
        price: 15.00,
        stock: 1,
        category: 'Electronics',
        image: 'limited.jpg',
        images: ['limited.jpg'],
        vendorId,
      },
    });
    const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
      .stock;

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          { productId, quantity: 1 },
          { productId: limitedProduct.id, quantity: 999 },
        ],
      });
    expect(res.status).toBe(409);

    // Stock of the first product must be unchanged
    const stockAfter = (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
      .stock;
    expect(stockAfter).toBe(Number(stockBefore));
  });

  it('6: vendor token → 403', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ items: [{ productId, quantity: 1 }] });
    expect(res.status).toBe(403);
  });

  it('7: unknown productId → 404', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: 'nonexistent-id', quantity: 1 }] });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/product not found/i);
  });

  it('8: with shippingAddress → 201', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId, quantity: 1 }],
        shippingAddress: { line1: '123 Main St', city: 'Lagos', state: 'LA', postcode: '100001', country: 'NG' },
      });
    expect(res.status).toBe(201);
  });

  it('9: with paymentMethod → 201', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 1 }], paymentMethod: 'card' });
    expect(res.status).toBe(201);
  });
});

// ─── GET /api/v1/orders (vendor/admin) ────────────────────────────────────────

describe('GET /api/v1/orders', () => {
  it('10: vendor sees only orders containing their own products', async () => {
    const foreign = await createForeignOrder();
    const res = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.orders.some((o: { id: string }) => o.id === foreign.id)).toBe(false);
  });

  it('10b: admin sees orders across all vendors, unscoped', async () => {
    const foreign = await createForeignOrder();
    const res = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.some((o: { id: string }) => o.id === foreign.id)).toBe(true);
  });

  it('10c: a different vendor sees only orders containing their own product', async () => {
    const foreign = await createForeignOrder();
    const res = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${otherVendorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.some((o: { id: string }) => o.id === foreign.id)).toBe(true);
  });

  it('11: customer blocked → 403', async () => {
    const res = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('12: filter by status', async () => {
    const res = await request(app)
      .get('/api/v1/orders?status=pending')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    for (const order of res.body.orders) {
      expect(order.status).toBe('pending');
    }
  });

  it('13: pagination respected', async () => {
    const res = await request(app)
      .get('/api/v1/orders?page=1&limit=2')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeLessThanOrEqual(2);
  });
});

// ─── GET /api/v1/orders/my (customer) ─────────────────────────────────────────

describe('GET /api/v1/orders/my', () => {
  it('14: customer gets only their own orders', async () => {
    const res = await request(app)
      .get('/api/v1/orders/my')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    for (const order of res.body.orders) {
      expect(order.customerId).toBe(customerId);
    }
  });

  it('15: vendor blocked → 403', async () => {
    const res = await request(app)
      .get('/api/v1/orders/my')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });

  it('16: filter by status scoped to customer', async () => {
    const res = await request(app)
      .get('/api/v1/orders/my?status=pending')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    for (const order of res.body.orders) {
      expect(order.status).toBe('pending');
      expect(order.customerId).toBe(customerId);
    }
  });
});

// ─── GET /api/v1/orders/:id ───────────────────────────────────────────────────

describe('GET /api/v1/orders/:id', () => {
  let ownOrderId: string;
  let otherOrderId: string;

  beforeAll(async () => {
    const otherCustomer = await createTestUser('customer');

    const [own, other] = await Promise.all([
      prisma.order.create({
        data: {
          customerId,
          customerName: 'Test Customer',
          customerEmail: 'c@test.com',
          items: [{ productId, productName: 'Test Widget', quantity: 1, unitPrice: 25 }] as never,
          total: 25,
          status: 'pending',
        },
      }),
      prisma.order.create({
        data: {
          customerId: otherCustomer.user.id,
          customerName: 'Other Customer',
          customerEmail: 'o@test.com',
          items: [{ productId, productName: 'Test Widget', quantity: 1, unitPrice: 25 }] as never,
          total: 25,
          status: 'pending',
        },
      }),
    ]);

    ownOrderId = own.id;
    otherOrderId = other.id;
  });

  it('12: customer fetches own order → 200', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${ownOrderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ownOrderId);
  });

  it("13: customer fetches another's order → 403", async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${otherOrderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('14: vendor fetches any customer order containing their own product → 200', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${otherOrderId}`)
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
  });

  it('14b: vendor blocked from an order containing only another vendor\'s product → 403', async () => {
    const foreign = await createForeignOrder();
    const res = await request(app)
      .get(`/api/v1/orders/${foreign.id}`)
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });

  it('14c: admin fetches any order regardless of vendor → 200', async () => {
    const foreign = await createForeignOrder();
    const res = await request(app)
      .get(`/api/v1/orders/${foreign.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('15: unknown order → 404', async () => {
    const res = await request(app)
      .get('/api/v1/orders/nonexistent-id')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/orders/:id/status ─────────────────────────────────────────

describe('PATCH /api/v1/orders/:id/status', () => {
  // productId isn't assigned until the top-level beforeAll runs, so this must
  // be evaluated lazily (at test-run time), not captured at describe-collection time.
  function ownedItems() {
    return [{ productId, productName: 'Test Widget', quantity: 1, unitPrice: 25 }] as never;
  }

  async function createPendingOrder() {
    return prisma.order.create({
      data: {
        customerId,
        customerName: 'Test Customer',
        customerEmail: 'c@test.com',
        items: ownedItems(),
        total: 0,
        status: 'pending',
      },
    });
  }

  it('16: pending → processing', async () => {
    const order = await createPendingOrder();
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'processing' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processing');
  });

  it('17: processing → shipped', async () => {
    const order = await prisma.order.create({
      data: { customerId, customerName: 'C', customerEmail: 'c@t.com', items: ownedItems(), total: 0, status: 'processing' },
    });
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'shipped' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('shipped');
  });

  it('18: shipped → delivered', async () => {
    const order = await prisma.order.create({
      data: { customerId, customerName: 'C', customerEmail: 'c@t.com', items: ownedItems(), total: 0, status: 'shipped' },
    });
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
  });

  it('19: pending → cancelled', async () => {
    const order = await createPendingOrder();
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('20: processing → cancelled', async () => {
    const order = await prisma.order.create({
      data: { customerId, customerName: 'C', customerEmail: 'c@t.com', items: ownedItems(), total: 0, status: 'processing' },
    });
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('21: shipped → pending (invalid backward) → 400', async () => {
    const order = await prisma.order.create({
      data: { customerId, customerName: 'C', customerEmail: 'c@t.com', items: ownedItems(), total: 0, status: 'shipped' },
    });
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'pending' });
    expect(res.status).toBe(400);

    // 'pending' is not in the schema enum, so Zod catches it → 400 with errors
    // That's fine — the result is still 400
  });

  it('22: delivered → cancelled (terminal) → 400', async () => {
    const order = await prisma.order.create({
      data: { customerId, customerName: 'C', customerEmail: 'c@t.com', items: ownedItems(), total: 0, status: 'delivered' },
    });
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid status transition/i);
  });

  it('23: customer token → 403', async () => {
    const order = await createPendingOrder();
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'processing' });
    expect(res.status).toBe(403);
  });

  it('24: vendor blocked from updating an order containing only another vendor\'s product → 403', async () => {
    const foreign = await createForeignOrder();
    const res = await request(app)
      .patch(`/api/v1/orders/${foreign.id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'processing' });
    expect(res.status).toBe(403);
  });

  it('25: admin updates any order regardless of vendor → 200', async () => {
    const foreign = await createForeignOrder();
    const res = await request(app)
      .patch(`/api/v1/orders/${foreign.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' });
    expect(res.status).toBe(200);
  });
});
