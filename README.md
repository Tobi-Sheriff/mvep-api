# MVEP API

REST API backend for the **Multi-Vendor E-Commerce Platform (MVEP)**. Replaces MSW mocks in the pre-built React frontend with real persistence backed by PostgreSQL.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20 LTS |
| Language | TypeScript 5 (strict) |
| Framework | Express.js |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| Email | Nodemailer (Mailtrap dev / Resend prod) |
| Validation | Zod |
| Security | Helmet · CORS · express-rate-limit |
| Testing | Jest · ts-jest · Supertest |

---

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16 running locally (or a connection string to a hosted instance)
- A [Mailtrap](https://mailtrap.io) account for email in development

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, SMTP_* credentials

# 3. Run database migrations
npm run db:migrate

# 4. Seed demo data (required for the frontend to work)
npm run db:seed

# 5. Start the development server
npm run dev
```

Server starts on `http://localhost:3000` by default.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mvep_dev
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/mvep_test
JWT_SECRET=your-secret-key-minimum-32-characters
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

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server with hot-reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output (production) |
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode for tests |
| `npm run db:migrate` | Apply pending Prisma migrations |
| `npm run db:seed` | Seed demo accounts and fixture data |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:reset` | Drop, re-migrate, and re-seed the database |

---

## API Overview

Base URL: `/api/v1`

All protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | Public |
| POST | `/auth/verify-email` | Public |
| POST | `/auth/resend-verification` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Any |
| GET | `/auth/me` | Any |

### Products
| Method | Path | Auth |
|--------|------|------|
| GET | `/products` | Public |
| GET | `/products/:id` | Public |
| GET | `/products/:id/reviews` | Public |
| POST | `/products` | Vendor / Admin |
| PUT | `/products/:id` | Vendor (own) / Admin |
| DELETE | `/products/:id` | Vendor (own) / Admin |

### Orders
| Method | Path | Auth |
|--------|------|------|
| GET | `/orders` | Any (scoped by role) |
| GET | `/orders/:id` | Owner / Vendor / Admin |
| POST | `/orders` | Customer |
| PATCH | `/orders/:id/status` | Vendor / Admin |

### Users
| Method | Path | Auth |
|--------|------|------|
| GET | `/users/profile` | Any |
| PUT | `/users/profile` | Any |
| GET | `/users/wishlist` | Customer |
| POST | `/users/wishlist/:productId` | Customer |
| DELETE | `/users/wishlist/:productId` | Customer |

### Analytics (vendor-scoped)
| Method | Path | Auth |
|--------|------|------|
| GET | `/analytics/overview` | Vendor / Admin |
| GET | `/analytics/revenue` | Vendor / Admin |
| GET | `/analytics/products/top` | Vendor / Admin |

### Admin (admin only)
| Method | Path |
|--------|------|
| GET | `/admin/stats` |
| GET | `/admin/users` |
| GET | `/admin/users/:id` |
| PATCH | `/admin/users/:id/status` |
| GET | `/admin/vendors` |
| GET | `/admin/orders` |
| GET | `/admin/analytics/platform` |

Full API contract: [docs/backend-spec.md](docs/backend-spec.md)

---

## Seed Accounts

After running `npm run db:seed`, these accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Customer | customer@mvep.dev | password |
| Vendor | vendor@mvep.dev | password |
| Admin | admin@mvep.dev | password |

---

## Project Structure

```
src/
├── app.ts                  Express app setup
├── server.ts               HTTP server entry point
├── config/                 Typed env config
├── lib/                    JWT, bcrypt, email, Prisma client, error classes
├── middleware/             authenticate, requireRole, errorHandler
└── modules/
    ├── auth/
    ├── products/
    ├── orders/
    ├── users/
    ├── analytics/
    └── admin/
prisma/
├── schema.prisma
└── seed.ts
tests/
docs/
├── backend-spec.md         Authoritative API contract
├── project-spec.md         Architecture decisions and conventions
├── execution-plan.md       Phase-by-phase build plan
└── test-cases.md           Full test case matrix
```

---

## Running Tests

```bash
# Make sure TEST_DATABASE_URL is set in .env
npm test

# Run a single test file
npm test -- tests/auth.test.ts

# Watch mode
npm run test:watch
```

Tests run against a dedicated test database. Migrations are applied automatically before the suite.

---

## Connecting to the Frontend

1. Start this API: `npm run dev` (port 3000)
2. In the frontend repo, set `VITE_API_BASE_URL=http://localhost:3000/api/v1`
3. Disable MSW in the frontend (set `VITE_MSW_ENABLED=false` or equivalent)
4. Log in with any seed account

---

## Documentation

| File | Contents |
|------|----------|
| [docs/backend-spec.md](docs/backend-spec.md) | Full API contract — all endpoints, request/response shapes, business rules |
| [docs/project-spec.md](docs/project-spec.md) | Architecture, module conventions, error handling strategy |
| [docs/execution-plan.md](docs/execution-plan.md) | Ordered build phases with task checklists |
| [docs/test-cases.md](docs/test-cases.md) | Every test scenario by module |
