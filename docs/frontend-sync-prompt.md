# Frontend Sync Prompt

> Paste this into a Claude session on the **frontend (MVEP) repo**.
> The backend API contract has been finalised. The frontend's RTK Query endpoints
> and MSW handlers need to be updated to match. Do not change any UI components —
> only the API layer (RTK Query endpoint definitions and MSW handler files).

---

## Prompt (copy everything below this line)

---

The MVEP backend has been built backend-first with a finalised API contract.
Some endpoint paths and request/response shapes differ from what the current MSW mocks use.
Your job is to update the **RTK Query API slice(s)** and **MSW handler files** to match the new contract.
Do not touch any UI components, pages, or Redux slices outside the API layer.

---

### Change 1 — Customer orders: new dedicated endpoint

**Old:** `GET /api/v1/orders?customerId=me`
**New:** `GET /api/v1/orders/my`

Update the RTK Query endpoint that fetches the customer's own orders to use `/orders/my`.
Update the corresponding MSW handler to handle `GET /api/v1/orders/my`.
The response shape is unchanged: `{ orders: Order[], total: number }`.

---

### Change 2 — Place order: request body simplified

**Old request body:**
```json
{
  "items": [{ "productId": "string", "productName": "string", "quantity": 1, "unitPrice": 49.99 }],
  "total": 49.99
}
```

**New request body:**
```json
{
  "items": [{ "productId": "string", "quantity": 1 }],
  "shippingAddress": {
    "line1": "string",
    "city": "string",
    "state": "string",
    "postcode": "string",
    "country": "string"
  },
  "paymentMethod": "card"
}
```

The backend now looks up `productName` and `unitPrice` from the database and calculates `total` server-side — the client must not send these fields.

Update the RTK Query `createOrder` mutation to send the new shape.
If `shippingAddress` and `paymentMethod` are not yet collected in the checkout UI, send reasonable placeholder values for now (e.g. `paymentMethod: 'card'`, `shippingAddress` with empty strings). The UI can be wired up properly later.
Update the MSW `POST /api/v1/orders` handler to accept the new body shape.

---

### Change 3 — Analytics revenue: response is now wrapped

**Old response:** `[{ "date": "string", "revenue": number, "orders": number }]` (bare array)

**New response:**
```json
{
  "data": [{ "date": "string", "revenue": number, "orders": number }],
  "total": number,
  "change": number
}
```

Update the RTK Query `getRevenue` (or equivalent) endpoint's `transformResponse` (or wherever the response is consumed) to read from `response.data` instead of the root array.
Update the MSW handler to return the wrapped shape.
`total` = sum of all `revenue` values in the array. `change` = any reasonable percentage number for the mock (e.g. `12.4`).

---

### Change 4 — Create product: request body uses `images[]` only

**Old:** `{ name, description, price, stock, category, image: "string", images: ["string"] }`
**New:** `{ name, description, price, stock, category, images: ["string"] }`

Remove the standalone `image` field from the create/update product request body.
The backend derives `image = images[0]` server-side.
The response still includes `image` (the backend returns it) — only the *request* changes.
Update the RTK Query mutation and MSW handler accordingly.

---

### Change 5 — Register response: handle optional `devCode`

The register endpoint now returns `devCode` only in development:
```json
{ "requiresVerification": true, "email": "string", "devCode": "string" }
```

If the verification flow currently requires the user to manually enter the code,
update the email verification screen to auto-fill the code input when `devCode` is present in the response.
This is a development convenience only — the UI should still work when `devCode` is absent.
Update the MSW handler to include `devCode` in its `register` response.

---

### Change 6 — Product reviews: new POST endpoint

The backend now supports submitting product reviews. This endpoint did not exist before.

**New endpoint:** `POST /api/v1/products/:id/reviews`
**Auth:** Any authenticated user. One review per user per product (duplicate → 409).

**Request body:**
```json
{ "rating": 5, "comment": "string" }
```
`rating` must be an integer between 1 and 5 inclusive.

**Response 201:**
```json
{
  "id": "string",
  "userId": "string",
  "userName": "string",
  "rating": 5,
  "comment": "string",
  "createdAt": "ISO 8601"
}
```

**Error responses:**
- `401` — unauthenticated
- `404` — product not found
- `409` — user already reviewed this product: `{ "message": "You have already reviewed this product" }`

**Side effect:** A successful POST atomically updates the product's `rating` (recalculated average, 2 d.p.) and `reviewCount`. Any cached product data should be invalidated after a successful review submission.

**What to add:**
1. RTK Query `createReview` mutation: `POST /api/v1/products/:id/reviews` with the body above.
2. After mutation success, invalidate the `getProduct` cache tag for that product ID so the updated rating/reviewCount is refetched.
3. MSW handler for `POST /api/v1/products/:id/reviews` — return a mock review object with status 201. Also update the MSW `GET /api/v1/products/:id` handler to include `reviewCount: number` in the response shape if it doesn't already.

---

### Summary of MSW handlers to update

| Handler | Change |
|---------|--------|
| `GET /api/v1/orders` | Vendor/admin only — remove customer scoping from this handler |
| `GET /api/v1/orders/my` | New handler — returns current user's orders |
| `POST /api/v1/orders` | Accept new slim request body; ignore `productName`, `unitPrice`, `total` if present |
| `GET /api/v1/analytics/revenue` | Return `{ data, total, change }` instead of bare array |
| `POST /api/v1/products` | Accept `images[]` only; no standalone `image` in request |
| `PUT /api/v1/products/:id` | Same as POST |
| `POST /api/v1/auth/register` | Include `devCode` in response |
| `POST /api/v1/products/:id/reviews` | New handler — return mock review with status 201 |

### TypeScript types to update

If any of the above endpoints have TypeScript request/response types defined (e.g. in an `api.types.ts` or inline in the RTK Query slice), update those types to match the new shapes. Specifically:
- `CreateOrderRequest` — remove `productName`, `unitPrice`, `total`; add `shippingAddress` and `paymentMethod`
- `RevenueResponse` — change from `DataPoint[]` to `{ data: DataPoint[], total: number, change: number }`
- `CreateProductRequest` — remove standalone `image` field
- `Review` / `CreateReviewRequest` / `CreateReviewResponse` — add these types if not present

---

No other files should be changed. After making the changes, confirm which files were modified.
