# MVEP API — Test Cases

> Integration tests use `supertest` against the Express app with a real test database (separate from dev DB).
> Unit tests cover pure functions: JWT helpers, hash helpers, business-rule guards.
> All test files live in `tests/`. Run with `npm test`.

---

## Test Setup & Teardown

```
beforeAll  → apply migrations to test DB, run seed
beforeEach → wrap each test in a transaction (rolled back after)
afterAll   → disconnect Prisma client
```

Helper: `createTestUser(role)` — creates a user with a known password and returns `{ user, token }`.

---

## Module 1 — Auth (`tests/auth.test.ts`)

### POST /auth/register

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | Happy path — customer | `{ name, email, password, role: 'customer' }` | `201 { requiresVerification: true, email }` |
| 2 | Happy path — vendor | `{ name, email, password, role: 'vendor' }` | `201 { requiresVerification: true, email }` |
| 3 | Duplicate email | Already-registered email | `409 { message }` |
| 4 | Admin role blocked | `{ role: 'admin' }` | `400 { message: "Cannot self-register as admin" }` |
| 5 | Missing required field | Omit `name` | `400 { message, errors: { name: "..." } }` |
| 6 | Invalid email format | `email: 'not-an-email'` | `400` validation error |
| 7 | Short password | `password: '123'` | `400` validation error |

### POST /auth/verify-email

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 8 | Happy path | Valid `{ email, code }` within 15 min | `200 { user, token }` |
| 9 | Wrong code | Correct email, wrong code | `400 { message }` |
| 10 | Expired code | Code older than 15 minutes | `400 { message: "...expired..." }` |
| 11 | Email not found | Unknown email | `404 { message }` |
| 12 | Vendor gets Vendor record | Verify a vendor registration | `Vendor` row exists in DB after `200` |

### POST /auth/resend-verification

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 13 | Happy path | Unverified email | `200 { message }` · new code in DB · old code deleted |
| 14 | Email not found | Unknown email | `404 { message }` |

### POST /auth/login

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 15 | Happy path — customer | `{ email: 'customer@mvep.dev', password: 'password' }` | `200 { user, token }` |
| 16 | Happy path — vendor | Seed vendor creds | `200 { user, token }` |
| 17 | Happy path — admin | Seed admin creds | `200 { user, token }` |
| 18 | Wrong password | Correct email, wrong password | `401 { message }` |
| 19 | Unknown email | Non-existent email | `401 { message }` |
| 20 | Unverified account | Registered but not verified | `403 { message }` |
| 21 | Suspended account | User with `status: 'suspended'` | `403 { message }` |
| 22 | Banned account | User with `status: 'banned'` | `403 { message }` |

### POST /auth/logout

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 23 | With valid token | Bearer token in header | `200 { message: "Logged out successfully" }` |
| 24 | Without token | No auth header | `401 { message }` |

### GET /auth/me

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 25 | Valid token | Bearer token | `200 { user }` · user shape matches spec |
| 26 | No token | Missing header | `401 { message }` |
| 27 | Malformed token | `Bearer garbage` | `401 { message }` |
| 28 | Expired token | Token past expiry | `401 { message }` |

---

## Module 2 — Products (`tests/products.test.ts`)

### GET /products

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | Default list | No params | `200 { data: [...], total, page: 1, totalPages }` · max 12 items |
| 2 | Pagination | `page=2&limit=5` | `200` with correct slice |
| 3 | Search | `search=laptop` | Only products whose name/description matches |
| 4 | Category filter | `category=Electronics` | All results have `category: 'Electronics'` |
| 5 | Price range | `minPrice=10&maxPrice=50` | All prices within range |
| 6 | Rating filter | `rating=4` | All results have `rating >= 4` |
| 7 | Sort `price_asc` | `sort=price_asc` | Results ordered cheapest first |
| 8 | Sort `price_desc` | `sort=price_desc` | Results ordered most-expensive first |
| 9 | Sort `newest` | `sort=newest` | Results ordered by `createdAt DESC` |
| 10 | Sort `popular` | `sort=popular` | Results ordered by `reviewCount DESC` |
| 11 | Response shape | Any call | Each item has `images[]`, `rating`, `reviewCount`, `vendorName` |

### GET /products/:id

| # | Scenario | Expected |
|---|----------|----------|
| 12 | Valid product | `200 CustomerProduct` with all fields |
| 13 | Unknown id | `404 { message }` |

### GET /products/:id/reviews

| # | Scenario | Expected |
|---|----------|----------|
| 14 | Product with reviews | `200 Review[]` |
| 15 | Product with no reviews | `200 []` |
| 16 | Unknown product | `404 { message }` |

### POST /products (requires vendor/admin token)

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 17 | Vendor creates product | Valid body + vendor token | `201 Product` · `vendorId` matches token owner |
| 18 | Admin creates product | Valid body + admin token | `201 Product` |
| 19 | Customer blocked | Customer token | `403 { message }` |
| 20 | Missing required field | Omit `price` | `400` validation error |
| 21 | Invalid category | `category: 'Furniture'` | `400` validation error |

### PUT /products/:id

| # | Scenario | Expected |
|---|----------|----------|
| 22 | Vendor updates own product | `200 Product` with updated fields |
| 23 | Vendor updates other vendor's product | `403 { message }` |
| 24 | Admin updates any product | `200 Product` |
| 25 | Unknown product | `404 { message }` |
| 26 | Customer attempts update | `403 { message }` |

### DELETE /products/:id

| # | Scenario | Expected |
|---|----------|----------|
| 27 | Vendor deletes own product | `200 { message: "Product deleted" }` |
| 28 | Vendor deletes other's product | `403 { message }` |
| 29 | Admin deletes any product | `200 { message }` |
| 30 | Unknown product | `404 { message }` |

---

## Module 3 — Orders (`tests/orders.test.ts`)

### POST /orders

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | Happy path | `{ items: [{productId, quantity}] }` with valid stock | `201 Order` · `total` calculated server-side · stock decremented |
| 2 | Response has server-calculated total | Any valid order | `total` in response equals sum of `quantity × unitPrice` looked up from DB |
| 3 | Response has server-populated item fields | Any valid order | Each item in response has `productName` and `unitPrice` from DB |
| 4 | Insufficient stock | `quantity > product.stock` | `409 { message: "Insufficient stock for: <name>" }` |
| 5 | Multiple items, one fails stock | Mix of valid + over-stock | `409` — nothing decremented (atomic transaction) |
| 6 | Vendor blocked | Vendor token | `403 { message }` |
| 7 | Unknown productId | Non-existent productId in items | `404 { message: "Product not found: <id>" }` |
| 8 | With shippingAddress | Include `shippingAddress` object | `201` — accepted and stored |
| 9 | With paymentMethod | Include `paymentMethod: 'card'` | `201` — accepted |

### GET /orders (vendor/admin)

| # | Scenario | Auth | Expected |
|---|----------|------|----------|
| 10 | Vendor sees all orders | Vendor token | `200 { orders, total }` · all platform orders |
| 11 | Customer blocked from this endpoint | Customer token | `403 { message }` |
| 12 | Filter by status | `status=pending` | Only `pending` orders returned |
| 13 | Pagination | `page=1&limit=5` | Correct page size |

### GET /orders/my (customer)

| # | Scenario | Auth | Expected |
|---|----------|------|----------|
| 14 | Customer gets own orders | Customer token | `200 { orders, total }` · only that customer's orders |
| 15 | Vendor blocked from this endpoint | Vendor token | `403 { message }` |
| 16 | Filter by status | Customer token + `status=pending` | Only customer's `pending` orders |

### GET /orders/:id

| # | Scenario | Auth | Expected |
|---|----------|------|----------|
| 12 | Customer fetches own order | Customer token | `200 Order` |
| 13 | Customer fetches other's order | Customer token | `403 { message }` |
| 14 | Vendor fetches any order | Vendor token | `200 Order` |
| 15 | Unknown order | Any token | `404 { message }` |

### PATCH /orders/:id/status

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 16 | `pending → processing` | `{ status: 'processing' }` | `200 Order` with new status |
| 17 | `processing → shipped` | `{ status: 'shipped' }` | `200 Order` |
| 18 | `shipped → delivered` | `{ status: 'delivered' }` | `200 Order` |
| 19 | `pending → cancelled` | `{ status: 'cancelled' }` | `200 Order` |
| 20 | `processing → cancelled` | `{ status: 'cancelled' }` | `200 Order` |
| 21 | `shipped → pending` (invalid backward) | `{ status: 'pending' }` | `400 { message }` |
| 22 | `delivered → cancelled` (invalid from terminal) | `{ status: 'cancelled' }` | `400 { message }` |
| 23 | Customer attempts status update | Customer token | `403 { message }` |

---

## Module 4 — Users (`tests/users.test.ts`)

### GET /users/profile

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Authenticated request | `200 { id, name, email, role, avatar }` |
| 2 | No token | `401` |

### PUT /users/profile

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 3 | Update name | `{ name: 'New Name' }` | `200` with updated name |
| 4 | Update avatar | `{ avatar: 'https://...' }` | `200` with updated avatar |
| 5 | Attempt to change email | `{ email: 'new@test.com' }` | Email unchanged (ignored or `400`) |
| 6 | Attempt to change role | `{ role: 'admin' }` | Role unchanged (ignored or `400`) |
| 7 | Empty name | `{ name: '' }` | `400` validation error |

### GET /users/wishlist

| # | Scenario | Expected |
|---|----------|----------|
| 8 | Customer with items | `200 ['p1', 'p3', 'p11']` (seed data) |
| 9 | Customer with empty wishlist | `200 []` |
| 10 | Vendor token | `403 { message }` |

### POST /users/wishlist/:productId

| # | Scenario | Expected |
|---|----------|----------|
| 11 | Add new product | `200 { productId, added: true }` · item in DB |
| 12 | Add duplicate (idempotent) | `200 { productId, added: true }` · no error, no duplicate |
| 13 | Unknown product | `404 { message }` |
| 14 | Vendor token | `403 { message }` |

### DELETE /users/wishlist/:productId

| # | Scenario | Expected |
|---|----------|----------|
| 15 | Remove existing | `200 { productId, removed: true }` |
| 16 | Remove non-existent | `200 { productId, removed: true }` (silent / idempotent) |
| 17 | Vendor token | `403 { message }` |

---

## Module 5 — Analytics (`tests/analytics.test.ts`)

### GET /analytics/overview

| # | Scenario | Auth | Expected |
|---|----------|------|----------|
| 1 | Vendor token | Vendor | `200` with all 6 fields; numbers are non-negative |
| 2 | Customer token | Customer | `403 { message }` |
| 3 | Values scoped to vendor | Vendor A has different numbers than Vendor B | Correct scoping |

### GET /analytics/revenue

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 4 | `period=7d` | Vendor token | `200 { data: [...], total, change }` · `data` has ≤7 points; each with `date`, `revenue`, `orders` |
| 5 | `period=30d` | Vendor token | `200` · `data` has ≤30 points |
| 6 | `period=90d` | Vendor token | `200` · `data` has ≤90 points |
| 7 | `period=1y` | Vendor token | `200` · `data` has ≤365 points |
| 8 | Invalid period | `period=3d` | `400` validation error |
| 9 | `total` field | Any valid period | `total` equals sum of all `data[].revenue` |
| 10 | `change` field | Any valid period | `change` is a number (positive = growth, negative = decline) |

### GET /analytics/products/top

| # | Scenario | Expected |
|---|----------|----------|
| 9 | Vendor with products | `200` array of ≤5 items, each with `id, name, revenue, unitsSold` |
| 10 | Sorted by revenue DESC | First item has highest revenue |

---

## Module 6 — Admin (`tests/admin.test.ts`)

> All tests use an admin token unless stated.

### GET /admin/stats

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Admin token | `200` with all 9 stat fields |
| 2 | Vendor token | `403 { message }` |
| 3 | Customer token | `403 { message }` |

### GET /admin/users

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 4 | Default list | No params | `200 { users, total, page, totalPages }` |
| 5 | Filter by role | `role=customer` | All returned users are customers |
| 6 | Filter by status | `status=banned` | All returned users are banned |
| 7 | Search by name | `search=Alice` | Returns users whose name contains "Alice" |
| 8 | Pagination | `page=1&limit=5` | Correct page |

### GET /admin/users/:id

| # | Scenario | Expected |
|---|----------|----------|
| 9 | Known user | `200 AdminUser` with `status, isVerified, createdAt` |
| 10 | Unknown user | `404 { message }` |

### PATCH /admin/users/:id/status

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 11 | Suspend a user | `{ status: 'suspended' }` | `200 { id, status, updatedAt }` |
| 12 | Ban a user | `{ status: 'banned' }` | `200 { id, status: 'banned', updatedAt }` |
| 13 | Reactivate | `{ status: 'active' }` | `200 { id, status: 'active', updatedAt }` |
| 14 | Admin self-ban | Admin bans own id | `400 { message }` |
| 15 | Unknown user | Non-existent id | `404 { message }` |

### GET /admin/vendors

| # | Scenario | Expected |
|---|----------|----------|
| 16 | Default list | `200 { vendors, total }` · each vendor has `productCount, totalRevenue, totalOrders` |
| 17 | Search | `search=Bob` | Filtered by storeName/user name |

### GET /admin/orders

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 18 | All orders | No params | `200 { orders, total }` · platform-wide |
| 19 | Filter by status | `status=shipped` | Only shipped orders |
| 20 | Filter by customerId | `customerId=1` | Only customer 1's orders |

### GET /admin/analytics/platform

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 21 | `period=7d` | Admin token | `200` array, each with `date, revenue, orders` — all vendors combined |
| 22 | Vendor token | Any | `403 { message }` |

---

## Unit Tests (`tests/unit/`)

### jwt.test.ts
- `signToken` returns a string
- `verifyToken(signToken(payload))` returns original payload
- `verifyToken` with expired token throws
- `verifyToken` with wrong secret throws

### hash.test.ts
- `hashPassword` returns a string different from input
- `comparePassword(plain, hash)` returns `true` for matching pair
- `comparePassword(wrongPlain, hash)` returns `false`

### orderTransitions.test.ts
- All valid transitions return `true`
- All invalid transitions return `false`
- Terminal state transitions (`delivered → *`, `cancelled → *`) all return `false`
