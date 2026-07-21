import request from 'supertest';
import { app } from '../src/app';
import { prisma, clearDatabase, createTestUser } from './helpers/testSetup';

// ─── Test data ────────────────────────────────────────────────────────────────

const SEED_COUNT = 15;

const seedData = [
  { name: 'Gaming Laptop', description: 'Powerful laptop for gaming', category: 'Electronics', price: 999.99, stock: 5, rating: 4.8, reviewCount: 150 },
  { name: 'Wireless Mouse', description: 'Ergonomic wireless mouse', category: 'Electronics', price: 29.99, stock: 50, rating: 4.2, reviewCount: 80 },
  { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard', category: 'Electronics', price: 89.99, stock: 20, rating: 4.5, reviewCount: 95 },
  { name: 'USB-C Hub', description: 'Multi-port USB-C hub', category: 'Electronics', price: 39.99, stock: 30, rating: 3.9, reviewCount: 45 },
  { name: '4K Monitor', description: '27-inch 4K display', category: 'Electronics', price: 299.99, stock: 8, rating: 4.7, reviewCount: 120 },
  { name: 'Cotton T-Shirt', description: 'Comfortable casual wear', category: 'Clothing', price: 19.99, stock: 100, rating: 3.8, reviewCount: 30 },
  { name: 'Running Shoes', description: 'Lightweight running shoes', category: 'Sports', price: 79.99, stock: 40, rating: 4.4, reviewCount: 60 },
  { name: 'Yoga Mat', description: 'Non-slip yoga mat', category: 'Sports', price: 24.99, stock: 60, rating: 4.1, reviewCount: 55 },
  { name: 'Python Cookbook', description: 'Learn Python programming', category: 'Books', price: 34.99, stock: 25, rating: 4.6, reviewCount: 200 },
  { name: 'Garden Gloves', description: 'Waterproof garden gloves', category: 'Home & Garden', price: 12.99, stock: 75, rating: 3.5, reviewCount: 20 },
  { name: 'Face Cream', description: 'Moisturising face cream', category: 'Beauty', price: 15.99, stock: 80, rating: 3.2, reviewCount: 15 },
  { name: 'LEGO Set', description: 'Creative building blocks for kids', category: 'Toys', price: 49.99, stock: 35, rating: 4.3, reviewCount: 70 },
  { name: 'Denim Jacket', description: 'Classic denim jacket', category: 'Clothing', price: 59.99, stock: 45, rating: 3.6, reviewCount: 25 },
  { name: 'Smart Watch', description: 'Fitness tracking smartwatch', category: 'Electronics', price: 199.99, stock: 12, rating: 4.9, reviewCount: 180 },
  { name: 'Coffee Maker', description: 'Automatic coffee machine', category: 'Home & Garden', price: 89.99, stock: 20, rating: 4.0, reviewCount: 50 },
];

const validBody = {
  name: 'New Product',
  description: 'A brand new product',
  price: 49.99,
  stock: 10,
  category: 'Electronics',
  images: ['https://example.com/product.jpg'],
};

// ─── Setup ────────────────────────────────────────────────────────────────────

let vendorToken: string;
let vendorId: string;
let adminToken: string;
let customerToken: string;
let seededProductIds: string[];

beforeAll(async () => {
  await clearDatabase();

  const vendor = await createTestUser('vendor');
  const admin = await createTestUser('admin', { withVendorProfile: true });
  const customer = await createTestUser('customer');

  vendorToken = vendor.token;
  adminToken = admin.token;
  customerToken = customer.token;

  const vendorRecord = await prisma.vendor.findUniqueOrThrow({
    where: { userId: vendor.user.id },
  });
  vendorId = vendorRecord.id;

  const now = Date.now();
  const created = await Promise.all(
    seedData.map((p, i) =>
      prisma.product.create({
        data: {
          ...p,
          image: `https://example.com/${i}.jpg`,
          images: [`https://example.com/${i}.jpg`],
          vendorId,
          createdAt: new Date(now - (SEED_COUNT - 1 - i) * 1000),
        },
      }),
    ),
  );
  seededProductIds = created.map((p) => p.id);
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});

// ─── GET /api/v1/products ─────────────────────────────────────────────────────

describe('GET /api/v1/products', () => {
  it('1: default list returns up to 12 items', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(12);
    expect(res.body.total).toBe(SEED_COUNT);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(Math.ceil(SEED_COUNT / 12));
  });

  it('2: pagination returns correct slice', async () => {
    const res = await request(app).get('/api/v1/products?page=2&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.page).toBe(2);
    expect(res.body.totalPages).toBe(3);
  });

  it('3: search filters by name and description', async () => {
    const res = await request(app).get('/api/v1/products?search=laptop');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const item of res.body.data) {
      const matched =
        item.name.toLowerCase().includes('laptop') ||
        item.description.toLowerCase().includes('laptop');
      expect(matched).toBe(true);
    }
  });

  it('4: category filter returns only matching products', async () => {
    const res = await request(app).get('/api/v1/products?category=Electronics');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(item.category).toBe('Electronics');
    }
  });

  it('5: price range filters correctly', async () => {
    const res = await request(app).get('/api/v1/products?minPrice=10&maxPrice=50');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(item.price).toBeGreaterThanOrEqual(10);
      expect(item.price).toBeLessThanOrEqual(50);
    }
  });

  it('6: rating filter returns products >= threshold', async () => {
    const res = await request(app).get('/api/v1/products?rating=4');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(item.rating).toBeGreaterThanOrEqual(4);
    }
  });

  it('7: sort=price_asc orders cheapest first', async () => {
    const res = await request(app).get('/api/v1/products?sort=price_asc&limit=100');
    expect(res.status).toBe(200);
    const prices = res.body.data.map((p: { price: number }) => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('8: sort=price_desc orders most expensive first', async () => {
    const res = await request(app).get('/api/v1/products?sort=price_desc&limit=100');
    expect(res.status).toBe(200);
    const prices = res.body.data.map((p: { price: number }) => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });

  it('9: sort=newest orders by createdAt DESC', async () => {
    const res = await request(app).get('/api/v1/products?sort=newest&limit=100');
    expect(res.status).toBe(200);
    const dates = res.body.data.map((p: { createdAt: string }) => new Date(p.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });

  it('10: sort=popular orders by reviewCount DESC', async () => {
    const res = await request(app).get('/api/v1/products?sort=popular&limit=100');
    expect(res.status).toBe(200);
    const counts = res.body.data.map((p: { reviewCount: number }) => p.reviewCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('11: response shape includes all required fields', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    const item = res.body.data[0];
    expect(Array.isArray(item.images)).toBe(true);
    expect(typeof item.rating).toBe('number');
    expect(typeof item.reviewCount).toBe('number');
    expect(typeof item.vendorName).toBe('string');
    expect(item).not.toHaveProperty('password');
  });
});

// ─── GET /api/v1/products/my ─────────────────────────────────────────────────

describe('GET /api/v1/products/my', () => {
  it('vendor sees only their own products', async () => {
    const res = await request(app)
      .get('/api/v1/products/my')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(SEED_COUNT);
    for (const item of res.body.data) {
      expect(item.vendorId).toBe(vendorId);
    }
  });

  it("a different vendor with no products sees an empty list, not the platform catalog", async () => {
    const otherVendor = await createTestUser('vendor');
    const res = await request(app)
      .get('/api/v1/products/my')
      .set('Authorization', `Bearer ${otherVendor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('supports the same filters as the public listing (e.g. category)', async () => {
    const res = await request(app)
      .get('/api/v1/products/my?category=Electronics')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(item.category).toBe('Electronics');
      expect(item.vendorId).toBe(vendorId);
    }
  });

  it('customer token → 403', async () => {
    const res = await request(app)
      .get('/api/v1/products/my')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('no token → 401', async () => {
    const res = await request(app).get('/api/v1/products/my');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/products/:id ─────────────────────────────────────────────────

describe('GET /api/v1/products/:id', () => {
  it('12: valid product returns CustomerProduct shape', async () => {
    const id = seededProductIds[0];
    const res = await request(app).get(`/api/v1/products/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body).toHaveProperty('images');
    expect(res.body).toHaveProperty('vendorName');
    expect(res.body).toHaveProperty('rating');
    expect(res.body).toHaveProperty('reviewCount');
  });

  it('13: unknown id returns 404', async () => {
    const res = await request(app).get('/api/v1/products/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});

// ─── GET /api/v1/products/:id/reviews ────────────────────────────────────────

describe('GET /api/v1/products/:id/reviews', () => {
  let productWithReviews: string;
  let reviewUserId: string;

  beforeAll(async () => {
    productWithReviews = seededProductIds[0];

    const reviewer = await createTestUser('customer');
    reviewUserId = reviewer.user.id;

    await prisma.review.createMany({
      data: [
        {
          productId: productWithReviews,
          userId: reviewUserId,
          userName: reviewer.user.name,
          rating: 5,
          comment: 'Excellent product!',
        },
        {
          productId: productWithReviews,
          userId: reviewUserId,
          userName: reviewer.user.name,
          rating: 4,
          comment: 'Very good.',
        },
      ],
    });
  });

  it('14: product with reviews returns Review[]', async () => {
    const res = await request(app).get(`/api/v1/products/${productWithReviews}/reviews`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('userId');
    expect(res.body[0]).toHaveProperty('userName');
    expect(res.body[0]).toHaveProperty('rating');
    expect(res.body[0]).toHaveProperty('comment');
    expect(res.body[0]).toHaveProperty('createdAt');
    expect(res.body[0]).not.toHaveProperty('productId');
  });

  it('15: product with no reviews returns []', async () => {
    const res = await request(app).get(`/api/v1/products/${seededProductIds[1]}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('16: unknown product returns 404', async () => {
    const res = await request(app).get('/api/v1/products/nonexistent-id/reviews');
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/products ────────────────────────────────────────────────────

describe('POST /api/v1/products', () => {
  it('17: vendor creates product → 201 VendorProduct', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(validBody.name);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('image');
    expect(res.body).toHaveProperty('vendorId');
    expect(res.body).not.toHaveProperty('rating');
    expect(res.body).not.toHaveProperty('vendorName');
  });

  it('18: admin (with vendor profile) creates product → 201', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('19: customer token → 403', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it('20: missing required field → 400 validation error', async () => {
    const { price: _p, ...body } = validBody;
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('price');
  });

  it('21: invalid category → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ ...validBody, category: 'Furniture' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('category');
  });
});

// ─── PUT /api/v1/products/:id ─────────────────────────────────────────────────

describe('PUT /api/v1/products/:id', () => {
  const updatedBody = { ...validBody, name: 'Updated Name', price: 59.99 };

  it('22: vendor updates own product → 200 with updated fields', async () => {
    const product = await prisma.product.create({
      data: { ...validBody, image: validBody.images[0], vendorId },
    });
    const res = await request(app)
      .put(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send(updatedBody);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.price).toBe(59.99);
  });

  it("23: vendor updates another vendor's product → 403", async () => {
    const otherVendor = await createTestUser('vendor');
    const otherVendorRecord = await prisma.vendor.findUniqueOrThrow({
      where: { userId: otherVendor.user.id },
    });
    const product = await prisma.product.create({
      data: { ...validBody, image: validBody.images[0], vendorId: otherVendorRecord.id },
    });
    const res = await request(app)
      .put(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send(updatedBody);
    expect(res.status).toBe(403);
  });

  it('24: admin updates any product → 200', async () => {
    const product = await prisma.product.create({
      data: { ...validBody, image: validBody.images[0], vendorId },
    });
    const res = await request(app)
      .put(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updatedBody);
    expect(res.status).toBe(200);
  });

  it('25: unknown product → 404', async () => {
    const res = await request(app)
      .put('/api/v1/products/nonexistent-id')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send(updatedBody);
    expect(res.status).toBe(404);
  });

  it('26: customer attempts update → 403', async () => {
    const product = await prisma.product.create({
      data: { ...validBody, image: validBody.images[0], vendorId },
    });
    const res = await request(app)
      .put(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send(updatedBody);
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/v1/products/:id ─────────────────────────────────────────────

describe('DELETE /api/v1/products/:id', () => {
  it('27: vendor deletes own product → 200', async () => {
    const product = await prisma.product.create({
      data: { ...validBody, image: validBody.images[0], vendorId },
    });
    const res = await request(app)
      .delete(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it("28: vendor deletes another vendor's product → 403", async () => {
    const otherVendor = await createTestUser('vendor');
    const otherVendorRecord = await prisma.vendor.findUniqueOrThrow({
      where: { userId: otherVendor.user.id },
    });
    const product = await prisma.product.create({
      data: { ...validBody, image: validBody.images[0], vendorId: otherVendorRecord.id },
    });
    const res = await request(app)
      .delete(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });

  it('29: admin deletes any product → 200', async () => {
    const product = await prisma.product.create({
      data: { ...validBody, image: validBody.images[0], vendorId },
    });
    const res = await request(app)
      .delete(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('30: unknown product → 404', async () => {
    const res = await request(app)
      .delete('/api/v1/products/nonexistent-id')
      .set('Authorization', `Bearer ${vendorToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/products/:id/reviews ───────────────────────────────────────

describe('POST /api/v1/products/:id/reviews', () => {
  let reviewProductId: string;

  beforeEach(async () => {
    // Fresh product for each review test — avoids duplicate-review conflicts
    const p = await prisma.product.create({
      data: { ...validBody, image: validBody.images[0], vendorId, rating: 0, reviewCount: 0 },
    });
    reviewProductId = p.id;
  });

  it('31: authenticated user posts review → 201 with review fields', async () => {
    const res = await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, comment: 'Great product!' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('userName');
    expect(res.body.rating).toBe(5);
    expect(res.body.comment).toBe('Great product!');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('32: review updates product rating and reviewCount', async () => {
    await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 4, comment: 'Pretty good.' });

    const productRes = await request(app).get(`/api/v1/products/${reviewProductId}`);
    expect(productRes.status).toBe(200);
    expect(productRes.body.reviewCount).toBe(1);
    expect(productRes.body.rating).toBeCloseTo(4, 1);
  });

  it('33: two reviews average into correct rating', async () => {
    await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, comment: 'Excellent!' });
    await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ rating: 3, comment: 'Decent.' });

    const productRes = await request(app).get(`/api/v1/products/${reviewProductId}`);
    expect(productRes.body.reviewCount).toBe(2);
    expect(productRes.body.rating).toBeCloseTo(4, 1); // (5+3)/2 = 4.00
  });

  it('34: duplicate review from same user → 409', async () => {
    await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, comment: 'First review.' });

    const res = await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 3, comment: 'Duplicate review.' });
    expect(res.status).toBe(409);
  });

  it('35: non-existent product → 404', async () => {
    const res = await request(app)
      .post('/api/v1/products/nonexistent-id/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 4, comment: 'Good.' });
    expect(res.status).toBe(404);
  });

  it('36: rating out of range → 400', async () => {
    const res = await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 6, comment: 'Off the charts!' });
    expect(res.status).toBe(400);
  });

  it('37: missing comment → 400', async () => {
    const res = await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 4 });
    expect(res.status).toBe(400);
  });

  it('38: unauthenticated → 401', async () => {
    const res = await request(app)
      .post(`/api/v1/products/${reviewProductId}/reviews`)
      .send({ rating: 4, comment: 'No token.' });
    expect(res.status).toBe(401);
  });
});
