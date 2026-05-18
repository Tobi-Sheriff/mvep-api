# MVEP API — Execution Plan

> Ordered build sequence for the backend. Complete each phase fully before moving to the next.
> Each phase ends with a working, testable state.

---

## Phase 0 — Project Scaffold ✅

**Goal:** Runnable Express + TypeScript server with no business logic yet.

### Tasks
- [x] `npm init -y`
- [x] Install production dependencies:
  ```
  express @prisma/client jsonwebtoken bcryptjs nodemailer
  helmet cors express-rate-limit zod dotenv
  ```
- [x] Install dev dependencies:
  ```
  typescript ts-node-dev @types/express @types/node @types/jsonwebtoken
  @types/bcryptjs @types/nodemailer @types/cors prisma
  jest ts-jest supertest @types/supertest @faker-js/faker
  ```
- [x] Create `tsconfig.json` (target ES2022, module CommonJS, strict mode)
- [x] Create `tsconfig.test.json` — extends base, includes `tests/` in rootDir
- [x] Create `jest.config.ts` — ts-jest preset, tests/ root, uses tsconfig.test.json
- [x] Create `src/app.ts` — Express app with helmet, cors, JSON body parser, placeholder routes
- [x] Create `src/server.ts` — `app.listen` on `process.env.PORT`
- [x] Create `src/config/index.ts` — Zod-validated env config; exits process on missing vars
- [x] Create `src/lib/errors.ts` — `AppError`, `NotFoundError`, `ForbiddenError`, `UnauthorisedError`, `ConflictError`, `BadRequestError`
- [x] Create `src/middleware/errorHandler.ts` — handles ZodError → 400, AppError → statusCode, Prisma P2002/P2025 via runtime check (no generated client needed yet)
- [x] Create `.env` and `.env.example` from the env variable list in the spec
- [x] Create `.gitignore`
- [x] Add `npm` scripts: `dev`, `build`, `start`, `test`, `test:watch`, `db:migrate`, `db:seed`, `db:studio`, `db:reset`
- [x] Add `prisma.seed` entry to `package.json`
- [x] Run `prisma init --datasource-provider postgresql` — creates `prisma/schema.prisma` and `prisma.config.ts`
- [x] Verify: `npm run dev` starts server, `GET /` returns `{ ok: true }`

### Deviations & notes
- **`prisma` CLI** added as a dev dep (not in original plan) — needed for `npm run db:*` scripts to work without `npx`.
- **`src/lib/errors.ts` + `src/middleware/errorHandler.ts`** built in Phase 0 rather than Phase 2 — they have no Prisma dependency and are needed by `app.ts` immediately.
- **Prisma 7** was installed (latest). It has breaking changes vs Prisma 4/5/6:
  - The `url` field is **removed** from `schema.prisma` entirely (applies to all generators).
  - CLI tools (migrate, studio) read the URL from `prisma.config.ts`.
  - `PrismaClient` at runtime requires a **driver adapter**: `@prisma/adapter-pg` + `pg` installed as dependencies.
  - Generator `provider = "prisma-client"` outputs TypeScript source to `src/generated/prisma/`.
  - Entry point is `src/generated/prisma/client.ts` — import as `'../generated/prisma/client'`.
  - See project-spec.md § 2 for the full note and usage example.
- **`errorHandler.ts`** uses a runtime duck-type check for Prisma errors instead of `instanceof Prisma.PrismaClientKnownRequestError` — avoids importing the (yet-to-be-generated) client. Will be revisited if needed after Phase 1.

---

## Phase 1 — Database Schema & Migrations ✅

**Goal:** All tables created in PostgreSQL via Prisma.

### Tasks
- [x] ~~`npx prisma init`~~ — already done in Phase 0; `prisma/schema.prisma` and `prisma.config.ts` exist
- [x] Define all models in `schema.prisma`:
  - `User` (id, name, email, password, role, status, isVerified, avatar, timestamps)
  - `Vendor` (id, userId FK, storeName, description, createdAt)
  - `Product` (id, name, description, price, stock, category, image, images[], rating, reviewCount, vendorId FK, timestamps)
  - `Review` (id, productId FK, userId FK, userName, rating, comment, createdAt)
  - `Order` (id, customerId FK, customerName, customerEmail, items Json, status, total, timestamps)
  - `Wishlist` (userId FK, productId FK — composite PK, createdAt)
  - `VerificationCode` (email PK, code, expiresAt)
- [x] Define enums: `UserRole`, `UserStatus`, `OrderStatus` — **`ProductCategory` is a `String` field, not an enum** (Prisma enum identifiers cannot contain `&` or spaces; "Home & Garden" would break it). Zod validates the allowed values at the API layer instead.
- [x] Run `npm run db:migrate -- --name init` — migration `20260518214419_init` applied
- [x] Create `src/lib/prisma.ts` — singleton PrismaClient using `PrismaPg` adapter; imported from `../generated/prisma/client`
- [x] Verify: `prisma migrate status` confirms DB is in sync; `npm run db:studio` opens Prisma Studio successfully

### Deviations & notes
- **`@prisma/adapter-pg` + `pg` + `@types/pg`** added as dependencies — required by Prisma 7 at runtime (see Phase 0 deviation note).
- **`ProductCategory` is `String` not enum** — Prisma enum values must be valid identifiers; "Home & Garden" is not. Allowed values (`Electronics`, `Clothing`, `Home & Garden`, `Sports`, `Books`, `Toys`, `Beauty`, `Food`) are enforced by Zod in `products.schema.ts` (Phase 4).

---

## Phase 2 — Shared Infrastructure ✅

**Goal:** Auth middleware, error handler, and utility libraries in place before any feature module.

### Tasks
- [x] `src/lib/jwt.ts` — `signToken(payload)` and `verifyToken(token)` helpers
- [x] `src/lib/hash.ts` — `hashPassword(plain)` and `comparePassword(plain, hashed)` helpers
- [x] `src/lib/email.ts` — `sendVerificationEmail(to, code)` using Nodemailer + Mailtrap config
- [x] `src/middleware/authenticate.ts` — verifies `Authorization: Bearer` header, attaches `req.user = { id, role }`; returns `401` if missing/invalid; augments `Express.Request` globally
- [x] `src/middleware/requireRole.ts` — factory `requireRole('vendor', 'admin')` → `403` if role not in list
- [x] `src/middleware/errorHandler.ts` — updated to use `Prisma.PrismaClientKnownRequestError` from generated client (replaces Phase 0 duck-type check)
- [x] `src/config/index.ts` — already done in Phase 0
- [x] Write unit tests for `jwt.ts`, `hash.ts` — **11/11 passing**

### Deviations & notes
- **`@types/jest`** was missing from original dev deps — added.
- **`jest.config.ts`** updated: replaced deprecated `globals['ts-jest']` format with the new `transform` array format.
- **`tsconfig.test.json`** updated: added `"types": ["jest", "node"]` so TypeScript recognises `describe`, `it`, `expect` globals without explicit imports.

---

## Phase 3 — Auth Module ✅

**Goal:** Full registration + email-verification + login flow working end-to-end.

### Endpoints
```
POST /api/v1/auth/register
POST /api/v1/auth/verify-email
POST /api/v1/auth/resend-verification
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### Tasks
- [x] `src/modules/auth/auth.schema.ts` — Zod schemas for each request body
- [x] `src/modules/auth/auth.service.ts` — business logic (DB queries, code generation, email send)
- [x] `src/modules/auth/auth.controller.ts` — thin HTTP layer, calls service, returns responses
- [x] `src/modules/auth/auth.router.ts` — Express router, wires endpoints
- [x] Mount router: `app.use('/api/v1/auth', authRouter)`
- [x] Business rules to enforce:
  - `admin` role cannot be self-registered (reject with `400`)
  - Verification code expires in 15 minutes
  - `resend-verification` invalidates (deletes) old code before creating new
  - `login` rejects suspended/banned users with `403`
  - `login` rejects unverified users with `403`
  - When `role=vendor`, auto-create `Vendor` record on successful email verification
- [x] Integration tests: `tests/auth.test.ts` — **28/28 passing**

### Deviations & notes
- **Zod 4 API change**: `z.enum` uses `error:` not `errorMap:` for custom error messages. Updated schema accordingly.
- **Admin role in Zod schema**: Schema accepts `'customer' | 'vendor' | 'admin'`; service throws `BadRequestError("Cannot self-register as admin")` before the DB write. This produces `400 { message: "Cannot self-register as admin" }` (no `errors` field) as specified in the contract.
- **devCode in non-production**: Register response includes `devCode` when `NODE_ENV !== 'production'` (covers both `development` and `test`). Used in integration tests to drive the verify-email flow without real email.
- **jest.config.ts** updated: added `setupFiles: ['<rootDir>/tests/helpers/jestSetup.ts']` to override `DATABASE_URL → TEST_DATABASE_URL` and set `NODE_ENV=test` before any module loads.
- **tests/helpers/jestSetup.ts**: Sets `DATABASE_URL = TEST_DATABASE_URL` and `NODE_ENV = 'test'` before test modules load. dotenv is called here first so the vars are available.
- **tests/helpers/testSetup.ts**: Exports `prisma`, `clearDatabase()` (TRUNCATE CASCADE), `createTestUser(role)` (creates verified user + Vendor record for vendor role).
- **Prerequisite**: Run `DATABASE_URL=<mvep_test_url> npx prisma migrate deploy` once before running integration tests.
- **sendVerificationEmail is mocked** in integration tests (`jest.mock`) — no real SMTP calls. Mock call arguments expose the generated code, enabling verify-email tests without DB queries.

---

## Phase 4 — Products Module

**Goal:** Full product CRUD with vendor ownership and two response shapes.

### Endpoints
```
GET    /api/v1/products
GET    /api/v1/products/:id
GET    /api/v1/products/:id/reviews
POST   /api/v1/products
PUT    /api/v1/products/:id
DELETE /api/v1/products/:id
```

### Tasks
- [ ] `src/modules/products/products.schema.ts` — Zod schemas
- [ ] `src/modules/products/products.service.ts`:
  - `listProducts(filters)` — paginate, filter (search, category, price, rating, sort), return `CustomerProduct[]` shape
  - `getProduct(id)` — return `CustomerProduct` with vendorName join
  - `getProductReviews(id)` — return `Review[]`
  - `createProduct(data, vendorId)` — return `Product` (vendor shape)
  - `updateProduct(id, data, requestingUser)` — ownership check
  - `deleteProduct(id, requestingUser)` — ownership check
- [ ] `src/modules/products/products.controller.ts`
- [ ] `src/modules/products/products.router.ts`
- [ ] Two response shape mappers:
  - `toCustomerProduct(product, vendor)` — includes `images[]`, `rating`, `reviewCount`, `vendorName`
  - `toVendorProduct(product)` — includes `image` (primary), no rating/reviews
- [ ] Integration tests: `tests/products.test.ts`

---

## Phase 5 — Orders Module

**Goal:** Place orders with stock decrement; list/get orders with role-based scoping; status transitions.

### Endpoints
```
GET   /api/v1/orders             (vendor/admin — all orders)
GET   /api/v1/orders/my          (customer — own orders only)
GET   /api/v1/orders/:id
PATCH /api/v1/orders/:id/status
POST  /api/v1/orders
```

### Tasks
- [ ] `src/modules/orders/orders.schema.ts` — Zod schemas
- [ ] `src/modules/orders/orders.service.ts`:
  - `createOrder(items, customer, shippingAddress?, paymentMethod?)` — Prisma transaction: look up product prices/names from DB, calculate total server-side, validate stock, decrement stock, create Order; reject `409` if insufficient stock
  - `listOrders(filters)` — vendor/admin only; paginated
  - `listMyOrders(customerId, filters)` — customer only; scoped to their own orders
  - `getOrder(id, requestingUser)` — 403 if customer accessing another user's order
  - `updateOrderStatus(id, newStatus, requestingUser)` — validate transition table
- [ ] Status transition guard:
  ```
  pending     → processing, cancelled
  processing  → shipped, cancelled
  shipped     → delivered
  delivered   → (terminal)
  cancelled   → (terminal)
  ```
- [ ] `src/modules/orders/orders.controller.ts`
- [ ] `src/modules/orders/orders.router.ts`
- [ ] Integration tests: `tests/orders.test.ts`

---

## Phase 6 — Users Module

**Goal:** Profile read/update and customer wishlist management.

### Endpoints
```
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
GET    /api/v1/users/wishlist
POST   /api/v1/users/wishlist/:productId
DELETE /api/v1/users/wishlist/:productId
```

### Tasks
- [ ] `src/modules/users/users.schema.ts` — Zod schemas
- [ ] `src/modules/users/users.service.ts`:
  - `getProfile(userId)` — returns `{ id, name, email, role, avatar }`
  - `updateProfile(userId, data)` — only `name` and `avatar` are mutable here
  - `getWishlist(userId)` — returns `string[]` of productIds
  - `addToWishlist(userId, productId)` — idempotent (upsert)
  - `removeFromWishlist(userId, productId)` — silent if not present
- [ ] `src/modules/users/users.controller.ts`
- [ ] `src/modules/users/users.router.ts`
- [ ] Integration tests: `tests/users.test.ts`

---

## Phase 7 — Analytics Module

**Goal:** Vendor-scoped analytics endpoints for the dashboard.

### Endpoints
```
GET /api/v1/analytics/overview
GET /api/v1/analytics/revenue?period=7d|30d|90d|1y
GET /api/v1/analytics/products/top
```

### Tasks
- [ ] `src/modules/analytics/analytics.service.ts`:
  - `getOverview(vendorId)` — aggregate revenue, orders, products, unique customers; compute % change vs prior period
  - `getRevenueSeries(vendorId, period)` — group-by-day revenue + order count for the period window; returns `{ data, total, change }`
  - `getTopProducts(vendorId)` — top 5 products by summed `unitPrice × quantity` across all orders
- [ ] Period math helper: given `'7d'`, return `{ start, end, prevStart, prevEnd }` for comparison
- [ ] `src/modules/analytics/analytics.controller.ts`
- [ ] `src/modules/analytics/analytics.router.ts`
- [ ] Integration tests: `tests/analytics.test.ts`

---

## Phase 8 — Admin Module

**Goal:** All `/admin/*` endpoints for the admin portal.

### Endpoints
```
GET   /api/v1/admin/stats
GET   /api/v1/admin/users
GET   /api/v1/admin/users/:id
PATCH /api/v1/admin/users/:id/status
GET   /api/v1/admin/vendors
GET   /api/v1/admin/orders
GET   /api/v1/admin/analytics/platform
```

### Tasks
- [ ] `src/modules/admin/admin.service.ts`:
  - `getPlatformStats()` — platform-wide aggregates (all vendors)
  - `listUsers(filters)` — paginated with role/status/search filters
  - `getUser(id)` — AdminUser shape
  - `updateUserStatus(targetId, status, requestingAdminId)` — self-ban guard
  - `listVendors(filters)` — vendor list with aggregate stats per vendor
  - `listAllOrders(filters)` — cross-vendor order list
  - `getPlatformRevenueSeries(period)` — like analytics but unscoped
- [ ] All routes protected by `requireRole('admin')`
- [ ] `src/modules/admin/admin.controller.ts`
- [ ] `src/modules/admin/admin.router.ts`
- [ ] Integration tests: `tests/admin.test.ts`

---

## Phase 9 — Seed Script

**Goal:** Deterministic seed with demo accounts and fixture data so the frontend works immediately.

### Tasks
- [ ] `prisma/seed.ts`:
  - Upsert the three seed users (customer, vendor, admin) with fixed IDs matching frontend MSW (`'1'`, `'2'`, `'3'`)
  - Hash passwords before insert
  - Create `Vendor` record for Bob Vendor
  - Seed 15 products (`p1`–`p15`) across all required categories
  - Seed 15 orders (`o1`–`o15`); `o13`–`o15` have `customerId='1'`
  - Seed wishlist entries: `(userId='1', productId='p1')`, `('p3')`, `('p11')`
  - Idempotent: use upsert/skip-if-exists so re-running seed is safe
- [ ] Add to `package.json`: `"prisma": { "seed": "ts-node prisma/seed.ts" }`
- [ ] Verify: after `npx prisma db seed`, logging in as `customer@mvep.dev / password` returns a valid JWT

---

## Phase 10 — Hardening & Final Validation

**Goal:** Production-readiness checks before the backend is handed off to the frontend.

### Tasks
- [ ] Rate limiting on auth endpoints: `express-rate-limit` max 10 req/15 min on `/auth/login` and `/auth/register`
- [ ] Helmet security headers on all routes
- [ ] CORS locked to `CORS_ORIGIN` env var; block requests from other origins
- [ ] Verify all error shapes match `{ message }` (or `{ message, errors }` for validation)
- [ ] Run full integration test suite — all tests green
- [ ] End-to-end smoke test: start backend, point frontend at it, disable MSW, log in as all three users
- [ ] Ensure `.env` is in `.gitignore`; committed `.env.example` has all keys with placeholder values

---

## Build Order Summary

```
Phase 0  Project scaffold          ~1 hour
Phase 1  DB schema + migrations    ~1 hour
Phase 2  Shared infrastructure     ~2 hours
Phase 3  Auth module               ~3 hours
Phase 4  Products module           ~3 hours
Phase 5  Orders module             ~3 hours
Phase 6  Users module              ~2 hours
Phase 7  Analytics module          ~2 hours
Phase 8  Admin module              ~2 hours
Phase 9  Seed script               ~1 hour
Phase 10 Hardening + validation    ~1 hour
─────────────────────────────────────────
Total estimated effort             ~21 hours
```
