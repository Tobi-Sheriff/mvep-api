# MVEP API — Definitive Contract

> **This file is the single source of truth for all request/response shapes.**
> It supersedes `backend-spec.md` and the original frontend MSW contract wherever they conflict.
> The backend is implemented to this contract. The frontend is updated to match it.

Base URL: `/api/v1`
Auth: `Authorization: Bearer <token>` on all protected routes.
All errors return `{ "message": "string" }`. Validation errors may add `"errors": { field: message }`.

---

## Auth — `/api/v1/auth`

### POST `/auth/register`
**Public**
```json
// Request
{ "name": "string", "email": "string", "password": "string", "role": "customer|vendor" }

// Response 201
{ "requiresVerification": true, "email": "string" }

// Response 201 — development only (NODE_ENV=development)
{ "requiresVerification": true, "email": "string", "devCode": "string" }

// Response 400 — admin role attempted
{ "message": "Cannot self-register as admin" }

// Response 409 — email in use
{ "message": "Email already in use" }
```

### POST `/auth/verify-email`
**Public**
```json
// Request
{ "email": "string", "code": "string" }

// Response 200
{
  "user": { "id": "string", "name": "string", "email": "string", "role": "customer|vendor|admin", "avatar": null },
  "token": "string"
}

// Response 400 — wrong or expired code
{ "message": "Invalid or expired verification code" }

// Response 404 — email not found
{ "message": "Email not found" }
```

### POST `/auth/resend-verification`
**Public**
```json
// Request
{ "email": "string" }

// Response 200
{ "message": "Verification email sent" }

// Response 404
{ "message": "Email not found" }
```

### POST `/auth/login`
**Public**
```json
// Request
{ "email": "string", "password": "string" }

// Response 200
{
  "user": { "id": "string", "name": "string", "email": "string", "role": "customer|vendor|admin", "avatar": null },
  "token": "string"
}

// Response 401 — wrong credentials
{ "message": "Invalid email or password" }

// Response 403 — unverified
{ "message": "Please verify your email before logging in" }

// Response 403 — suspended or banned
{ "message": "Account suspended" | "Account banned" }
```

### POST `/auth/logout`
**Protected (any role)**
```json
// Response 200
{ "message": "Logged out successfully" }
```

### GET `/auth/me`
**Protected (any role)**
```json
// Response 200
{ "user": { "id": "string", "name": "string", "email": "string", "role": "string", "avatar": null } }

// Response 401
{ "message": "Unauthorised" }
```

---

## Products — `/api/v1/products`

### GET `/products`
**Public**

Query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `12` | Items per page |
| `search` | string | — | Full-text search on name + description |
| `category` | string | — | Exact match on category |
| `minPrice` | number | — | Inclusive lower bound |
| `maxPrice` | number | — | Inclusive upper bound |
| `rating` | number | — | Minimum average rating |
| `sort` | string | `newest` | `newest` \| `price_asc` \| `price_desc` \| `popular` |

```json
// Response 200
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "price": 0.00,
      "stock": 0,
      "category": "string",
      "images": ["string"],
      "rating": 0.0,
      "reviewCount": 0,
      "vendorId": "string",
      "vendorName": "string",
      "createdAt": "ISO 8601"
    }
  ],
  "total": 0,
  "page": 1,
  "totalPages": 0
}
```

### GET `/products/:id`
**Public**
```json
// Response 200 — same CustomerProduct shape as above
// Response 404
{ "message": "Product not found" }
```

### GET `/products/:id/reviews`
**Public**
```json
// Response 200
[
  {
    "id": "string",
    "userId": "string",
    "userName": "string",
    "rating": 0,
    "comment": "string",
    "createdAt": "ISO 8601"
  }
]
```

### POST `/products`
**Protected — vendor or admin**

> `vendorId` is derived server-side from the authenticated user's vendor profile.
> `image` (primary) is derived server-side as `images[0]`.

```json
// Request
{
  "name": "string",
  "description": "string",
  "price": 0.00,
  "stock": 0,
  "category": "Electronics|Clothing|Home & Garden|Sports|Books|Toys|Beauty|Food",
  "images": ["string"]
}

// Response 201 — vendor product shape (no rating/reviews)
{
  "id": "string",
  "name": "string",
  "description": "string",
  "price": 0.00,
  "stock": 0,
  "category": "string",
  "image": "string",
  "vendorId": "string",
  "createdAt": "ISO 8601"
}

// Response 403 — customer token
{ "message": "Forbidden" }
```

### PUT `/products/:id`
**Protected — vendor (own) or admin**
```json
// Request — same shape as POST
// Response 200 — same vendor product shape
// Response 403 — not the owner
// Response 404 — not found
```

### DELETE `/products/:id`
**Protected — vendor (own) or admin**
```json
// Response 200
{ "message": "Product deleted" }
// Response 403 / 404
```

---

## Orders — `/api/v1/orders`

> **Design note:** Customers use the dedicated `/orders/my` endpoint.
> The base `/orders` endpoint (vendor/admin) never returns a customer's view.

### GET `/orders`
**Protected — vendor or admin only**

Query params: `status`, `page` (default 1), `limit` (default 20)

```json
// Response 200
{ "orders": [Order], "total": 0 }
```

### GET `/orders/my`
**Protected — customer only**

Query params: `status`, `page` (default 1), `limit` (default 20)

```json
// Response 200
{ "orders": [Order], "total": 0 }

// Response 403 — non-customer token
{ "message": "Forbidden" }
```

### GET `/orders/:id`
**Protected — order owner (customer), vendor, or admin**
```json
// Response 200 — Order object
// Response 403 — customer accessing another user's order
// Response 404 — order not found
```

### POST `/orders`
**Protected — customer only**

> `customerId`, `customerName`, `customerEmail` are set server-side from the token.
> `productName` and `unitPrice` are looked up from the DB — never trusted from the client.
> `total` is calculated server-side — never trusted from the client.

```json
// Request
{
  "items": [
    { "productId": "string", "quantity": 1 }
  ],
  "shippingAddress": {
    "line1": "string",
    "city": "string",
    "state": "string",
    "postcode": "string",
    "country": "string"
  },
  "paymentMethod": "card"
}

// Response 201
{
  "id": "string",
  "customerId": "string",
  "customerName": "string",
  "customerEmail": "string",
  "items": [
    { "productId": "string", "productName": "string", "quantity": 1, "unitPrice": 0.00 }
  ],
  "status": "pending",
  "total": 0.00,
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}

// Response 403 — non-customer token
{ "message": "Forbidden" }

// Response 404 — unknown productId in items
{ "message": "Product not found: <productId>" }

// Response 409 — insufficient stock
{ "message": "Insufficient stock for: <productName>" }
```

### PATCH `/orders/:id/status`
**Protected — vendor or admin**

Valid transitions:
- `pending → processing`
- `pending → cancelled`
- `processing → shipped`
- `processing → cancelled`
- `shipped → delivered`
- `delivered` and `cancelled` are terminal — no further transitions

```json
// Request
{ "status": "processing|shipped|delivered|cancelled" }

// Response 200 — updated Order object
// Response 400 — invalid transition
{ "message": "Invalid status transition: <current> → <requested>" }
// Response 403 — customer token
// Response 404 — order not found
```

---

## Users — `/api/v1/users`

### GET `/users/profile`
**Protected (any role)**
```json
// Response 200
{ "id": "string", "name": "string", "email": "string", "role": "string", "avatar": null }
```

### PUT `/users/profile`
**Protected (any role)**
```json
// Request — only name and avatar are mutable via this endpoint
{ "name": "string", "avatar": "string|null" }

// Response 200
{ "id": "string", "name": "string", "email": "string", "role": "string", "avatar": "string|null" }
```

### GET `/users/wishlist`
**Protected — customer**
```json
// Response 200
["p1", "p3", "p11"]
```

### POST `/users/wishlist/:productId`
**Protected — customer** — idempotent
```json
// Response 200
{ "productId": "string", "added": true }
// Response 404 — product not found
```

### DELETE `/users/wishlist/:productId`
**Protected — customer** — idempotent (silent if not in wishlist)
```json
// Response 200
{ "productId": "string", "removed": true }
```

---

## Analytics — `/api/v1/analytics`

All analytics endpoints: **Protected — vendor or admin**. Scoped to the authenticated vendor's products/orders.

### GET `/analytics/overview`
```json
// Response 200
{
  "totalRevenue": 0.00,
  "totalOrders": 0,
  "totalProducts": 0,
  "totalCustomers": 0,
  "revenueChange": 0.0,
  "ordersChange": 0.0
}
```
`revenueChange` and `ordersChange` are percentage changes vs the previous equivalent period.

### GET `/analytics/revenue`
Query: `period=7d|30d|90d|1y`
```json
// Response 200
{
  "data": [{ "date": "YYYY-MM-DD", "revenue": 0.00, "orders": 0 }],
  "total": 0.00,
  "change": 0.0
}
```
`total` is the sum of revenue across the period. `change` is percentage change vs the previous equivalent period.

### GET `/analytics/products/top`
```json
// Response 200
[
  { "id": "string", "name": "string", "revenue": 0.00, "unitsSold": 0 }
]
```
Top 5 products by revenue for the authenticated vendor.

---

## Admin — `/api/v1/admin`

**All admin endpoints require `role === 'admin'`. Returns `403` for any other role.**

### GET `/admin/stats`
```json
// Response 200
{
  "totalRevenue": 0.00,
  "totalOrders": 0,
  "totalProducts": 0,
  "totalVendors": 0,
  "totalCustomers": 0,
  "totalUsers": 0,
  "revenueChange": 0.0,
  "ordersChange": 0.0,
  "newUsersThisMonth": 0
}
```

### GET `/admin/users`
Query: `role`, `status`, `search` (name/email), `page`, `limit` (default 20)
```json
// Response 200
{
  "users": [
    {
      "id": "string", "name": "string", "email": "string",
      "role": "string", "status": "active|suspended|banned",
      "isVerified": true, "avatar": null, "createdAt": "ISO 8601"
    }
  ],
  "total": 0,
  "page": 1,
  "totalPages": 0
}
```

### GET `/admin/users/:id`
```json
// Response 200 — AdminUser shape (same as above, single object)
// Response 404
```

### PATCH `/admin/users/:id/status`
```json
// Request
{ "status": "active|suspended|banned", "reason": "string (optional)" }

// Response 200
{ "id": "string", "status": "string", "updatedAt": "ISO 8601" }

// Response 400 — self-ban attempt
{ "message": "Cannot change your own status" }

// Response 404
{ "message": "User not found" }
```

### GET `/admin/vendors`
Query: `status`, `search`, `page`, `limit`
```json
// Response 200
{
  "vendors": [
    {
      "id": "string", "userId": "string", "storeName": "string",
      "userStatus": "active|suspended|banned",
      "productCount": 0, "totalRevenue": 0.00, "totalOrders": 0,
      "createdAt": "ISO 8601"
    }
  ],
  "total": 0
}
```

### GET `/admin/orders`
Query: `status`, `vendorId`, `customerId`, `page`, `limit`
```json
// Response 200
{ "orders": [Order], "total": 0 }
```

### GET `/admin/analytics/platform`
Query: `period=7d|30d|90d|1y`
```json
// Response 200 — same shape as /analytics/revenue but unscoped (all vendors)
{
  "data": [{ "date": "YYYY-MM-DD", "revenue": 0.00, "orders": 0 }],
  "total": 0.00,
  "change": 0.0
}
```
