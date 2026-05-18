# MVEP — Backend Specification

> This document is the authoritative contract between the React frontend and the backend server.
> Everything here is derived directly from the working frontend code (MSW handlers, TypeScript types, RTK Query endpoints).
> The frontend is **already complete and running against MSW mocks** — the backend must match this contract exactly.

---

## Recommended Tech Stack

### Core

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Node.js 20 LTS** | Matches frontend tooling, same language (TypeScript end-to-end) |
| Language | **TypeScript 5** | Type-safe, matches frontend, better DX |
| Framework | **Express.js** | Most recognised in interviews, massive ecosystem, simple mental model. Fastify is a solid alternative (faster, better native TS support) |
| Database | **PostgreSQL 16** | Industry standard, ACID compliant, native JSON columns (good for `OrderItem[]`), excellent Prisma support |
| ORM | **Prisma** | Best-in-class TypeScript integration, auto-generates types from schema, readable migrations, widely used in Node.js ecosystem |

### Auth & Security

| Package | Purpose |
|---------|---------|
| `jsonwebtoken` | JWT signing and verification |
| `bcryptjs` | Password hashing (bcrypt, 10 rounds) |
| `nodemailer` | Email sending for verification codes |
| `helmet` | Sets secure HTTP headers |
| `cors` | CORS configuration (allow frontend origin) |
| `express-rate-limit` | Rate-limit auth endpoints (prevent brute force) |

### Validation & Config

| Package | Purpose |
|---------|---------|
| `zod` | Request body validation — same library as the frontend, schemas can mirror each other |
| `dotenv` | Environment variable management |

### Testing

| Package | Purpose |
|---------|---------|
| `jest` + `ts-jest` | Unit and integration tests |
| `supertest` | HTTP integration tests against the Express app |
| `@faker-js/faker` | Seed and test data generation |

### Suggested project structure

```
src/
├── app.ts                  Express app setup (middleware, routes)
├── server.ts               Port binding + server start
├── config/                 env vars, constants
├── modules/
│   ├── auth/               register, verify, login, me
│   ├── products/           CRUD, storefront, reviews
│   ├── orders/             place order, status update, list
│   ├── users/              profile, wishlist
│   ├── analytics/          vendor-scoped revenue, overview, top products
│   └── admin/              platform stats, user management, vendor list
├── middleware/
│   ├── authenticate.ts     JWT verification → req.user
│   ├── requireRole.ts      Role guard middleware
│   └── errorHandler.ts     Global error handler → { message }
├── prisma/
│   ├── schema.prisma       Data model
│   └── seed.ts             Demo accounts + fixture data
└── lib/
    ├── jwt.ts              sign / verify helpers
    ├── email.ts            nodemailer wrapper
    └── hash.ts             bcrypt helpers
```

### Environment variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mvep
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=3000
CORS_ORIGIN=http://localhost:5173
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-password
EMAIL_FROM=noreply@mvep.dev
NODE_ENV=development
```

> For email in development, use **Mailtrap** (free sandbox that captures all outgoing email) or **Resend** (generous free tier, great DX). In production, **Resend** or **SendGrid** are recommended.

---

## 1. Project Context

MVEP (Multi-Vendor E-Commerce Platform) is a full-stack application with three user portals:

| Portal | Route prefix | Users |
|--------|-------------|-------|
| Customer Storefront | `/store/*` | Customers |
| Vendor Dashboard | `/vendor/*` | Vendors |
| Admin Console | `/admin/*` | Admin (platform owner / staff) |

The frontend is a React 18 SPA (TypeScript, Redux Toolkit, RTK Query). All API calls go to `/api/v1/*`. The frontend currently uses MSW v2 to mock all responses — the backend replaces those mocks with real persistence.

---

## 2. Authentication

### Mechanism
- **JWT Bearer tokens** — issued on login and email verification
- Token format: `Bearer <jwt>` in the `Authorization` header on every protected request
- Token payload must include: `{ sub: userId, role: UserRole, iat, exp }`
- Token expiry: recommend 7 days (with optional refresh token flow)

### Registration flow
```
POST /auth/register
  → creates user (unverified)
  → generates 6-digit code
  → sends verification email
  → returns { requiresVerification: true, email }

POST /auth/verify-email  { email, code }
  → validates code (TTL: 15 minutes recommended)
  → marks user as verified
  → returns { user, token }   ← JWT issued here, user is now logged in

POST /auth/resend-verification  { email }
  → generates new code, invalidates old one
  → re-sends email
```

### Login flow
```
POST /auth/login  { email, password }
  → validates credentials
  → checks user.isVerified === true  (reject 403 if unverified)
  → returns { user, token }
```

### User status
Users can have a `status` field: `'active' | 'suspended' | 'banned'`
- Suspended/banned users receive `403 Forbidden` on login
- The admin portal manages status changes (`PATCH /admin/users/:id/status`)

---

## 3. Data Models

### User
```
id            UUID / string (PK)
name          string
email         string (unique)
password      string (bcrypt hashed)
role          'customer' | 'vendor' | 'admin'
status        'active' | 'suspended' | 'banned'   default: 'active'
isVerified    boolean                              default: false
avatar        string | null
createdAt     ISO 8601 timestamp
updatedAt     ISO 8601 timestamp
```

### Vendor (profile linked to a User with role='vendor')
```
id            UUID / string (PK)
userId        FK → User
storeName     string
description   string | null
createdAt     ISO 8601 timestamp
```

### Product
```
id            UUID / string (PK)
name          string
description   string
price         decimal (2 d.p.)
stock         integer >= 0
category      'Electronics' | 'Clothing' | 'Home & Garden' | 'Sports' | 'Books' | 'Toys' | 'Beauty' | 'Food'
image         string (primary image URL)
images        string[]  (all image URLs including primary)
rating        decimal (computed average, stored for read performance)
reviewCount   integer   (computed count, stored for read performance)
vendorId      FK → Vendor
createdAt     ISO 8601 timestamp
updatedAt     ISO 8601 timestamp
```

### Review
```
id            UUID / string (PK)
productId     FK → Product
userId        FK → User
userName      string (denormalised at write time)
rating        integer 1–5
comment       string
createdAt     ISO 8601 timestamp
```

### Order
```
id            UUID / string (PK)
customerId    FK → User (role='customer')
customerName  string (denormalised)
customerEmail string (denormalised)
items         JSON array of OrderItem (see below)
status        'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
total         decimal (2 d.p.)
createdAt     ISO 8601 timestamp
updatedAt     ISO 8601 timestamp
```

### OrderItem (embedded in Order)
```
productId     string
productName   string (denormalised at order creation time)
quantity      integer >= 1
unitPrice     decimal (price at time of purchase)
```

### Wishlist
```
userId        FK → User
productId     FK → Product
createdAt     ISO 8601 timestamp
PRIMARY KEY   (userId, productId)
```

### VerificationCode
```
email         string (FK → User.email)
code          string (6 digits)
expiresAt     timestamp (15 minutes from creation)
```

---

## 4. API Reference

Base URL: `/api/v1`

All protected routes require `Authorization: Bearer <token>`.
Role requirements are noted per endpoint.

---

### Auth — `/auth`

#### `POST /auth/register`
**Public**

Request body:
```json
{ "name": "string", "email": "string", "password": "string", "role": "customer | vendor" }
```
Note: `role` is user-supplied on registration. `admin` role cannot be self-registered — it must be seeded or granted by an existing admin.

Success `201`:
```json
{ "requiresVerification": true, "email": "string" }
```
Errors: `409` email already in use.

---

#### `POST /auth/verify-email`
**Public**

Request:
```json
{ "email": "string", "code": "string" }
```
Success `200`:
```json
{ "user": User, "token": "string" }
```
Errors: `400` invalid/expired code, `404` email not found.

---

#### `POST /auth/resend-verification`
**Public**

Request:
```json
{ "email": "string" }
```
Success `200`:
```json
{ "message": "Verification email sent" }
```
Errors: `404` email not found.

---

#### `POST /auth/login`
**Public**

Request:
```json
{ "email": "string", "password": "string" }
```
Success `200`:
```json
{ "user": User, "token": "string" }
```
Errors: `401` wrong credentials, `403` account not verified or suspended/banned.

---

#### `POST /auth/logout`
**Protected (any role)**

Invalidate the token server-side if using a token blocklist, or simply acknowledge.
Success `200`:
```json
{ "message": "Logged out successfully" }
```

---

#### `GET /auth/me`
**Protected (any role)**

Returns the currently authenticated user from token.
Success `200`:
```json
{ "user": User }
```
Errors: `401` missing/invalid token.

---

### Products — `/products`

#### `GET /products`
**Public** (customer-facing storefront view)

Query params:

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | default `1` |
| `limit` | integer | default `12` |
| `search` | string | full-text search on name + description |
| `category` | string | exact match on category |
| `minPrice` | number | inclusive lower bound |
| `maxPrice` | number | inclusive upper bound |
| `rating` | number | minimum average rating |
| `sort` | string | `newest` \| `price_asc` \| `price_desc` \| `popular` |

Success `200` — **customer product shape** (includes `images`, `rating`, `reviewCount`, `vendorName`):
```json
{
  "data": [CustomerProduct],
  "total": 42,
  "page": 1,
  "totalPages": 4
}
```

---

#### `GET /products/:id`
**Public**

Returns single `CustomerProduct`.
Errors: `404` product not found.

---

#### `GET /products/:id/reviews`
**Public**

Returns `Review[]` for a product.

---

#### `POST /products`
**Protected — vendor or admin**

Creates a product owned by the authenticated vendor.
Request body:
```json
{
  "name": "string",
  "description": "string",
  "price": 99.99,
  "stock": 50,
  "category": "Electronics",
  "image": "string (URL)",
  "images": ["string"]
}
```
`vendorId` is set server-side from the authenticated user's vendor profile.
Success `201`: returns created `Product`.

---

#### `PUT /products/:id`
**Protected — vendor (own products only) or admin**

Full update. Backend must verify `product.vendorId === authenticatedUser.vendorId` unless role is `admin`.
Success `200`: returns updated `Product`.
Errors: `403` not the owner, `404` not found.

---

#### `DELETE /products/:id`
**Protected — vendor (own products only) or admin**

Success `200`:
```json
{ "message": "Product deleted" }
```
Errors: `403` not the owner, `404` not found.

---

### Orders — `/orders`

#### `GET /orders`
**Protected — vendor sees all platform orders; customer sees only their own**

Query params:

| Param | Type | Description |
|-------|------|-------------|
| `status` | OrderStatus | filter by status |
| `page` | integer | default `1` |
| `limit` | integer | default `20` |
| `customerId` | `'me'` | when present, scope to authenticated user's orders |

Vendor/admin call without `customerId=me` → all orders.
Customer call with `customerId=me` → their orders only (server enforces this regardless of what ID is passed).

Success `200`:
```json
{ "orders": [Order], "total": 15 }
```

---

#### `GET /orders/:id`
**Protected — order owner (customer) or vendor or admin**

Success `200`: returns `Order`.
Errors: `403` not authorized, `404` not found.

---

#### `PATCH /orders/:id/status`
**Protected — vendor or admin only**

Request:
```json
{ "status": "processing | shipped | delivered | cancelled" }
```
Valid transitions: `pending → processing → shipped → delivered`. `cancelled` can be set from `pending` or `processing`.
Success `200`: returns updated `Order`.
Errors: `400` invalid transition, `403` not authorized, `404` not found.

---

#### `POST /orders`
**Protected — customer only**

Places a new order. `customerId` is set server-side from the token.
Request:
```json
{
  "items": [{ "productId": "string", "productName": "string", "quantity": 1, "unitPrice": 49.99 }],
  "total": 49.99
}
```
Backend should validate: product exists, stock >= quantity, total matches calculated sum.
Backend should decrement `product.stock` on order creation.
Success `201`: returns created `Order`.

---

### Users — `/users`

#### `GET /users/profile`
**Protected (any role)**

Returns the authenticated user's profile.
Success `200`:
```json
{ "id": "string", "name": "string", "email": "string", "role": "string", "avatar": null }
```

---

#### `PUT /users/profile`
**Protected (any role)**

Updates name, avatar. Email and role changes are not allowed via this endpoint.
Request:
```json
{ "name": "string", "avatar": "string | null" }
```
Success `200`: returns updated user profile.

---

#### `GET /users/wishlist`
**Protected — customer**

Returns `string[]` of product IDs in the authenticated user's wishlist.
Success `200`:
```json
["p1", "p3", "p11"]
```

---

#### `POST /users/wishlist/:productId`
**Protected — customer**

Adds product to wishlist (idempotent).
Success `200`:
```json
{ "productId": "string", "added": true }
```
Errors: `404` product not found.

---

#### `DELETE /users/wishlist/:productId`
**Protected — customer**

Removes product from wishlist.
Success `200`:
```json
{ "productId": "string", "removed": true }
```

---

### Analytics — `/analytics`

All analytics endpoints are **Protected — vendor or admin**.
A vendor sees analytics scoped to **their own products and orders**.
An admin sees analytics scoped to their vendor profile (use `/admin/analytics/*` for platform-wide).

#### `GET /analytics/overview`
Returns summary stat cards for the vendor dashboard.
Success `200`:
```json
{
  "totalRevenue": 34518.39,
  "totalOrders": 312,
  "totalProducts": 15,
  "totalCustomers": 248,
  "revenueChange": 12.4,
  "ordersChange": 8.1
}
```
`revenueChange` and `ordersChange` are percentage changes vs the previous equivalent period.

---

#### `GET /analytics/revenue`
Query params: `period` = `7d | 30d | 90d | 1y`

Success `200` — array of daily data points:
```json
[{ "date": "2024-02-18", "revenue": 542.50, "orders": 7 }]
```

---

#### `GET /analytics/products/top`
Returns top 5 products by revenue for the vendor.
Success `200`:
```json
[{ "id": "p1", "name": "string", "revenue": 12249.51, "unitsSold": 49 }]
```

---

### Admin — `/admin`

**All admin endpoints require `role === 'admin'`.**
Return `403` for any other role.

These endpoints power the Admin Console portal (Phase 3b, upcoming in the frontend).

---

#### `GET /admin/stats`
Platform-wide overview.
Success `200`:
```json
{
  "totalRevenue": 98450.20,
  "totalOrders": 1248,
  "totalProducts": 210,
  "totalVendors": 18,
  "totalCustomers": 934,
  "totalUsers": 956,
  "revenueChange": 14.2,
  "ordersChange": 9.7,
  "newUsersThisMonth": 47
}
```

---

#### `GET /admin/users`
List all users with filters.
Query params: `role`, `status`, `search` (name/email), `page`, `limit` (default 20).
Success `200`:
```json
{
  "users": [AdminUser],
  "total": 956,
  "page": 1,
  "totalPages": 48
}
```
`AdminUser` = `User + { status, isVerified, createdAt }`

---

#### `GET /admin/users/:id`
Returns full user profile.
Success `200`: `AdminUser`

---

#### `PATCH /admin/users/:id/status`
Ban, suspend, or reactivate a user.
Request:
```json
{ "status": "active | suspended | banned", "reason": "string (optional)" }
```
Admin cannot ban themselves.
Success `200`:
```json
{ "id": "string", "status": "banned", "updatedAt": "ISO 8601" }
```
Errors: `400` self-ban attempt, `404` not found.

---

#### `GET /admin/vendors`
List all vendor profiles with their aggregate stats.
Query params: `status`, `search`, `page`, `limit`.
Success `200`:
```json
{
  "vendors": [{
    "id": "string",
    "userId": "string",
    "storeName": "string",
    "userStatus": "active | suspended | banned",
    "productCount": 15,
    "totalRevenue": 34518.39,
    "totalOrders": 312,
    "createdAt": "ISO 8601"
  }],
  "total": 18
}
```

---

#### `GET /admin/orders`
All orders across all vendors, with full filters.
Query params: `status`, `vendorId`, `customerId`, `page`, `limit`.
Success `200`:
```json
{ "orders": [Order], "total": 1248 }
```

---

#### `GET /admin/analytics/platform`
Platform-wide revenue + orders time series.
Query params: `period` = `7d | 30d | 90d | 1y`
Success `200`:
```json
[{ "date": "2024-02-18", "revenue": 2850.40, "orders": 34 }]
```

---

## 5. Business Rules

| Rule | Detail |
|------|--------|
| Free shipping | Orders with `total >= 50` have `shipping = 0`, otherwise `shipping = 5.99`. **Frontend calculates this client-side** — backend should validate the total. |
| Stock decrement | `POST /orders` must atomically decrement `product.stock` for each item. Reject with `409` if stock is insufficient. |
| Product ownership | Vendors can only edit/delete their own products. Admins can edit/delete any product. |
| Order visibility | Customers see only their own orders (`customerId=me`). Vendors see all orders for their store. |
| Status transitions | `pending → processing → shipped → delivered` is the forward flow. `cancelled` is allowed from `pending` or `processing` only. |
| Rating/reviewCount | These are computed fields on `Product`. Recalculate when a review is created or deleted. |
| Email uniqueness | Enforced at the database level and returns `409` from `POST /auth/register`. |
| Admin self-protection | An admin cannot change their own `status` to `suspended` or `banned`. |
| Vendor self-registration | Users can register as `vendor`. The backend creates a linked `Vendor` profile automatically on first login or as part of registration. |

---

## 6. Error Response Format

All errors return a consistent JSON shape:
```json
{ "message": "Human-readable error description" }
```
Field-level validation errors (e.g., form submissions) may additionally include:
```json
{
  "message": "Validation failed",
  "errors": { "email": "Must be a valid email", "password": "Min 8 characters" }
}
```

---

## 7. Response Shape Reference (TypeScript)

These types are taken directly from the frontend source:

```typescript
type UserRole = 'customer' | 'vendor' | 'admin';
type UserStatus = 'active' | 'suspended' | 'banned';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
}

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// Customer-facing product (storefront + product detail)
interface CustomerProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];      // full array, first element is primary
  rating: number;
  reviewCount: number;
  vendorId: string;
  vendorName: string;
  createdAt: string;
}

// Vendor-facing product (dashboard CRUD)
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: string;         // primary image only
  vendorId: string;
  createdAt: string;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

type AnalyticsPeriod = '7d' | '30d' | '90d' | '1y';

interface AnalyticsOverview {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  revenueChange: number;   // % change vs previous period
  ordersChange: number;    // % change vs previous period
}

interface RevenueDataPoint {
  date: string;            // YYYY-MM-DD
  revenue: number;
  orders: number;
}

interface TopProduct {
  id: string;
  name: string;
  revenue: number;
  unitsSold: number;
}
```

---

## 8. Seed Data (for development)

The frontend MSW mocks use these accounts — mirror them in your seed script:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Customer | customer@mvep.dev | password | id='1', pre-verified |
| Vendor | vendor@mvep.dev | password | id='2', pre-verified |
| Admin | admin@mvep.dev | password | id='3', pre-verified, super-admin |

15 seeded products (`p1`–`p15`) in categories: Electronics, Sports, Clothing, Home & Garden, Books, Beauty, Toys, Food.
15 seeded orders (`o1`–`o15`): `o13`–`o15` belong to the demo customer account (`customerId: '1'`).
Demo customer wishlist: `['p1', 'p3', 'p11']`
