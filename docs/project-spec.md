# MVEP API — Project Specification

> Single source of truth for architecture decisions, module responsibilities, and cross-cutting concerns.
> Read this before touching any module.

---

## 1. Overview

**MVEP** (Multi-Vendor E-Commerce Platform) backend is a REST API that replaces MSW mocks in a pre-built React frontend. The frontend is complete and under no circumstances should be modified. The backend's sole job is to satisfy the API contract defined in `backend-spec.md`.

### Three user portals

| Portal | Users | Route scope |
|--------|-------|-------------|
| Customer Storefront | Shoppers | `/store/*` (frontend) → `/api/v1/products`, `/api/v1/orders`, `/api/v1/users` |
| Vendor Dashboard | Sellers | `/vendor/*` (frontend) → `/api/v1/products` (CRUD), `/api/v1/analytics` |
| Admin Console | Platform staff | `/admin/*` (frontend) → `/api/v1/admin` |

---

## 2. Tech Stack Decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 20 LTS | LTS stability; matches frontend tooling |
| Language | TypeScript 5 (strict) | End-to-end type safety; Prisma generates types |
| Framework | Express.js | Widest recognition; minimal magic; easy to test |
| Database | PostgreSQL 16 | ACID; native JSONB for `OrderItem[]`; best Prisma support |
| ORM | Prisma | Auto-generated TypeScript types; readable migrations |
| Auth | `jsonwebtoken` + `bcryptjs` | Industry standard; lightweight |
| Email | `nodemailer` (Mailtrap dev / Resend prod) | Easy sandbox testing; Resend scales |
| Validation | `zod` (same as frontend) | Schemas can mirror frontend schemas exactly |
| Testing | `jest` + `ts-jest` + `supertest` | First-class TypeScript; real HTTP testing |

**Decision: Prisma 7 (latest) with `@prisma/adapter-pg`.** Prisma 7 removed the `url` field from `schema.prisma` entirely — even with `prisma-client-js`. All connections now go through a driver adapter. Project layout:
- Generator `provider = "prisma-client"` outputs TypeScript source to `src/generated/prisma/`.
- Datasource URL lives in `prisma.config.ts` (for CLI tools: migrate, studio). No `url` in `schema.prisma`.
- **Runtime (`PrismaClient`) requires `@prisma/adapter-pg`**: `new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) })`.
- **All Prisma imports use**: `import { PrismaClient } from '../generated/prisma/client'` (note `/client` suffix — that's the entry point file in the generated directory).
- Model types are imported from the same path: `import type { User, Order } from '../generated/prisma/client'`.

**Decision: No refresh tokens in v1.** Tokens have a 7-day TTL. A refresh token flow can be added in v2 without breaking the frontend.

**Decision: Denormalise `customerName`, `customerEmail`, `userName` (reviews).** These are written at creation time. Historical records remain accurate even if a user later changes their name.

**Decision: Store `rating` and `reviewCount` directly on `Product`.** Recomputed on every review write. Avoids expensive aggregation on every product list query.

---

## 3. Project Structure

```
mvep-api/
├── src/
│   ├── app.ts                     Express app (middleware + routes)
│   ├── server.ts                  HTTP server bootstrap
│   ├── generated/
│   │   └── prisma/                Auto-generated Prisma client (Prisma 7) — git-ignored
│   ├── config/
│   │   └── index.ts               Zod-validated env config; process.exit(1) on missing vars
│   ├── lib/
│   │   ├── prisma.ts              Singleton PrismaClient (imports from ../generated/prisma)
│   │   ├── errors.ts              AppError + subclasses (NotFound, Forbidden, etc.)
│   │   ├── jwt.ts                 signToken / verifyToken
│   │   ├── hash.ts                hashPassword / comparePassword
│   │   └── email.ts               sendVerificationEmail wrapper
│   ├── middleware/
│   │   ├── authenticate.ts        JWT → req.user; 401 on failure
│   │   ├── requireRole.ts         requireRole(...roles) factory; 403 on mismatch
│   │   └── errorHandler.ts        Global Express error handler
│   └── modules/
│       ├── auth/                  register, verify-email, login, me, logout
│       ├── products/              public list/get, vendor CRUD, reviews
│       ├── orders/                create, list, get, status update
│       ├── users/                 profile, wishlist
│       ├── analytics/             vendor-scoped revenue, overview, top products
│       └── admin/                 platform stats, user/vendor/order management
├── prisma/
│   ├── schema.prisma              Data model + enums
│   ├── migrations/                Generated migration SQL files
│   └── seed.ts                    Demo accounts + fixture data
├── tests/
│   ├── helpers/
│   │   └── testSetup.ts           DB setup, token factories, request helpers
│   ├── unit/
│   │   ├── jwt.test.ts
│   │   ├── hash.test.ts
│   │   └── orderTransitions.test.ts
│   ├── auth.test.ts
│   ├── products.test.ts
│   ├── orders.test.ts
│   ├── users.test.ts
│   ├── analytics.test.ts
│   └── admin.test.ts
├── docs/
│   ├── backend-spec.md            Original frontend MSW contract (reference)
│   ├── api-contract.md            Definitive backend-authored API contract
│   ├── project-spec.md            ← this file
│   ├── execution-plan.md          Phase-by-phase build plan (with completion status)
│   ├── test-cases.md              Full test case matrix
│   └── frontend-sync-prompt.md    Prompt to update frontend after backend is built
├── .env                           Local secrets (git-ignored)
├── .env.example                   Template — all keys, no real values
├── .gitignore
├── package.json
├── prisma.config.ts               Prisma 7 config — datasource URL, migrations path
├── tsconfig.json                  Production TypeScript config
├── tsconfig.test.json             Test TypeScript config (includes tests/ in rootDir)
├── jest.config.ts                 Jest config (ts-jest, tests/ root)
└── README.md
```

### Module convention
Each module contains exactly four files:
- `*.schema.ts` — Zod request schemas
- `*.service.ts` — business logic + Prisma queries
- `*.controller.ts` — HTTP layer; calls service; formats response
- `*.router.ts` — Express Router; wires paths → middleware → controller

No module imports from another module's service directly. Cross-module data needs (e.g., analytics needing order data) go through Prisma — not by calling another module's service.

---

## 4. Data Models

See `backend-spec.md § 3` for the full field list. Key notes:

- **IDs:** Use Prisma's default `cuid()` for new records. Seed records use fixed string IDs (`'1'`, `'2'`, `'3'` for users; `'p1'`–`'p15'` for products; `'o1'`–`'o15'` for orders) to match frontend MSW expectations.
- **Timestamps:** `createdAt` and `updatedAt` managed by Prisma (`@default(now())`, `@updatedAt`). Always returned as ISO 8601 strings.
- **Order items:** Stored as `Json` in Postgres (`items Json`). Cast to `OrderItem[]` in the service layer before returning.
- **Prices and totals:** Stored as `Decimal` in Prisma/Postgres. Returned as `number` (JavaScript float) in JSON responses. Use `parseFloat(decimal.toString())` when serialising.

---

## 5. Authentication & Authorisation

### JWT payload
```typescript
interface JwtPayload {
  sub: string;    // user.id
  role: UserRole; // 'customer' | 'vendor' | 'admin'
  iat: number;
  exp: number;
}
```

### `req.user` shape (set by `authenticate.ts`)
```typescript
interface AuthUser {
  id: string;
  role: UserRole;
}
```

### Role guard usage
```typescript
router.get('/admin/stats', authenticate, requireRole('admin'), adminController.getStats);
router.post('/products',   authenticate, requireRole('vendor', 'admin'), productsController.create);
```

### Vendor ownership check
Vendors can only mutate their own products. The check is done in the service layer:
```typescript
const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
if (product.vendorId !== vendor.id) throw new ForbiddenError();
```

---

## 6. Error Handling

All errors propagate to `errorHandler.ts` via `next(err)`.

| Error type | HTTP status | Body |
|------------|-------------|------|
| `ZodError` | `400` | `{ message: "Validation failed", errors: {...} }` |
| Prisma `P2002` (unique violation) | `409` | `{ message: "..." }` |
| Prisma `P2025` (not found) | `404` | `{ message: "Not found" }` |
| Custom `NotFoundError` | `404` | `{ message }` |
| Custom `ForbiddenError` | `403` | `{ message }` |
| Custom `UnauthorisedError` | `401` | `{ message }` |
| Custom `ConflictError` | `409` | `{ message }` |
| Unhandled | `500` | `{ message: "Internal server error" }` (no stack in prod) |

Define custom error classes in `src/lib/errors.ts`. They carry a `statusCode` property read by `errorHandler.ts`.

---

## 7. API Base URL & Versioning

All routes are mounted under `/api/v1`. The version prefix is added once in `app.ts`:
```typescript
app.use('/api/v1/auth',      authRouter);
app.use('/api/v1/products',  productsRouter);
app.use('/api/v1/orders',    ordersRouter);
app.use('/api/v1/users',     usersRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/admin',     adminRouter);
```

---

## 8. Environment Variables

| Variable | Description | Dev value |
|----------|-------------|-----------|
| `DATABASE_URL` | Postgres connection string | `postgresql://localhost:5432/mvep_dev` |
| `TEST_DATABASE_URL` | Separate DB for tests | `postgresql://localhost:5432/mvep_test` |
| `JWT_SECRET` | Signing secret (min 32 chars) | Any long random string |
| `JWT_EXPIRES_IN` | Token TTL | `7d` |
| `PORT` | HTTP port | `3000` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `SMTP_HOST` | Email server host | `smtp.mailtrap.io` |
| `SMTP_PORT` | Email server port | `587` |
| `SMTP_USER` | Email server user | Mailtrap credentials |
| `SMTP_PASS` | Email server password | Mailtrap credentials |
| `EMAIL_FROM` | From address | `noreply@mvep.dev` |
| `NODE_ENV` | Environment | `development` |

`src/config/index.ts` reads these with `zod` validation and throws at startup if any required variable is missing.

---

## 9. Business Rules Quick Reference

| Rule | Where enforced |
|------|---------------|
| Admin role cannot be self-registered | `auth.service.ts → register()` |
| Vendor Vendor profile auto-created on verification | `auth.service.ts → verifyEmail()` |
| Verification code TTL: 15 minutes | `VerificationCode.expiresAt` at creation |
| Suspended/banned users rejected at login | `auth.service.ts → login()` |
| Product ownership check (vendor vs own) | `products.service.ts → updateProduct(), deleteProduct()` |
| Stock decrement in Prisma transaction | `orders.service.ts → createOrder()` |
| Order status transition validation | `orders.service.ts → updateOrderStatus()` |
| Customer order scoping | `orders.service.ts → listOrders(), getOrder()` |
| Rating/reviewCount recomputed on review write | `products.service.ts → createReview(), deleteReview()` (future) |
| Admin cannot self-ban | `admin.service.ts → updateUserStatus()` |

---

## 10. Seed Data

The seed script at `prisma/seed.ts` creates deterministic data for local development:

| Entity | Count | IDs |
|--------|-------|-----|
| Users | 3 | `'1'` (customer), `'2'` (vendor), `'3'` (admin) |
| Vendors | 1 | Linked to user `'2'` |
| Products | 15 | `'p1'`–`'p15'` |
| Orders | 15 | `'o1'`–`'o15'`; `o13`–`o15` owned by customer `'1'` |
| Wishlist entries | 3 | `p1`, `p3`, `p11` for customer `'1'` |

Run: `npx prisma db seed`

---

## 11. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | `jest` | Pure functions: JWT, hashing, transition guards |
| Integration | `supertest` | Full HTTP round-trip against test DB |
| Smoke | Manual | Start server, connect frontend, log in as all 3 users |

Integration tests **do not mock Prisma**. They use a dedicated `TEST_DATABASE_URL` database, run migrations before the suite, and wrap each test in a transaction that rolls back after.

Coverage target: **all happy paths + all documented error paths** (see `test-cases.md`).
