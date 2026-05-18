import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import * as emailModule from '../src/lib/email';
import { config } from '../src/config';
import { prisma, clearDatabase, createTestUser } from './helpers/testSetup';

jest.mock('../src/lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const sendEmail = emailModule.sendVerificationEmail as jest.Mock;

const validCustomer = {
  name: 'Alice Customer',
  email: 'alice@example.com',
  password: 'SecurePass1!',
  role: 'customer' as const,
};

const validVendor = {
  name: 'Bob Vendor',
  email: 'bob@example.com',
  password: 'SecurePass1!',
  role: 'vendor' as const,
};

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── POST /auth/register ─────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('1: happy path — customer', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validCustomer);
    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.email).toBe(validCustomer.email);
    expect(sendEmail).toHaveBeenCalledWith(validCustomer.email, expect.any(String));
  });

  it('2: happy path — vendor', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validVendor);
    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.email).toBe(validVendor.email);
  });

  it('3: duplicate email → 409', async () => {
    await request(app).post('/api/v1/auth/register').send(validCustomer);
    const res = await request(app).post('/api/v1/auth/register').send(validCustomer);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/email already in use/i);
  });

  it('4: admin role → 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validCustomer, role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot self-register as admin/i);
  });

  it('5: missing name → 400 with field error', async () => {
    const { name: _n, ...body } = validCustomer;
    const res = await request(app).post('/api/v1/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('name');
  });

  it('6: invalid email format → 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validCustomer, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('email');
  });

  it('7: short password → 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validCustomer, password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('password');
  });
});

// ─── POST /auth/verify-email ─────────────────────────────────────────────────

describe('POST /api/v1/auth/verify-email', () => {
  it('8: happy path — returns user and token', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(validCustomer);
    const { devCode, email } = reg.body as { devCode: string; email: string };

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email, code: devCode });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('9: wrong code → 400', async () => {
    await request(app).post('/api/v1/auth/register').send(validCustomer);
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: validCustomer.email, code: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  it('10: expired code → 400', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(validCustomer);
    const { devCode, email } = reg.body as { devCode: string; email: string };

    // Backdate the code
    await prisma.verificationCode.update({
      where: { email },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email, code: devCode });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  it('11: unknown email → 404', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: 'nobody@example.com', code: '123456' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/email not found/i);
  });

  it('12: vendor verification auto-creates Vendor record', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(validVendor);
    const { devCode, email } = reg.body as { devCode: string; email: string };

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email, code: devCode });
    expect(res.status).toBe(200);

    const vendor = await prisma.vendor.findFirst({
      where: { user: { email } },
    });
    expect(vendor).not.toBeNull();
  });
});

// ─── POST /auth/resend-verification ──────────────────────────────────────────

describe('POST /api/v1/auth/resend-verification', () => {
  it('13: happy path — sends new code, old code invalidated', async () => {
    await request(app).post('/api/v1/auth/register').send(validCustomer);
    const originalCode = sendEmail.mock.calls[0][1] as string;

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: validCustomer.email });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Verification email sent');

    const newCode = sendEmail.mock.calls[1][1] as string;

    // Old code no longer works
    const oldVerify = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: validCustomer.email, code: originalCode });
    expect(oldVerify.status).toBe(400);

    // New code works
    const newVerify = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: validCustomer.email, code: newCode });
    expect(newVerify.status).toBe(200);
  });

  it('14: unknown email → 404', async () => {
    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(404);
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('15: happy path — customer', async () => {
    const { user, password } = await createTestUser('customer');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.role).toBe('customer');
  });

  it('16: happy path — vendor', async () => {
    const { user, password } = await createTestUser('vendor');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('vendor');
  });

  it('17: happy path — admin', async () => {
    const { user, password } = await createTestUser('admin');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('18: wrong password → 401', async () => {
    const { user } = await createTestUser('customer');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'WrongPassword!' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('19: unknown email → 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('20: unverified account → 403', async () => {
    const { user } = await createTestUser('customer');
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: false } });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'TestPassword123!' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  it('21: suspended account → 403', async () => {
    const { user, password } = await createTestUser('customer');
    await prisma.user.update({ where: { id: user.id }, data: { status: 'suspended' } });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/suspended/i);
  });

  it('22: banned account → 403', async () => {
    const { user, password } = await createTestUser('customer');
    await prisma.user.update({ where: { id: user.id }, data: { status: 'banned' } });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/banned/i);
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('23: valid token → 200', async () => {
    const { token } = await createTestUser('customer');
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
  });

  it('24: no token → 401', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('25: valid token → user shape', async () => {
    const { user, token } = await createTestUser('customer');
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.name).toBeDefined();
    expect(res.body.user.email).toBeDefined();
    expect(res.body.user.role).toBeDefined();
    expect(res.body.user).toHaveProperty('avatar');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('26: no token → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('27: malformed token → 401', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer garbage.token.here');
    expect(res.status).toBe(401);
  });

  it('28: expired token → 401', async () => {
    const expired = jwt.sign({ sub: 'user-1', role: 'customer' }, config.JWT_SECRET, {
      expiresIn: -1,
    });
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});
