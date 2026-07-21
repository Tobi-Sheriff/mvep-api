# MVEP — Deployment & Hosting Guide

> Reference checklist for taking the backend (this repo) and the frontend (separate repo) live.
> Two independent repos, two independent deploys, wired together by env vars.

---

## 1. Architecture

```
Frontend (React + Vite)  --->  Backend (Express + Prisma)  --->  PostgreSQL
   hosted on Vercel              hosted on Render                managed Postgres add-on
```

- Frontend calls the backend at `VITE_API_BASE_URL` (build-time env var, baked into the static bundle).
- Backend allows the frontend's origin via `CORS_ORIGIN`.
- No shared filesystem, no shared process — the only coupling is "frontend knows the backend's URL" and "backend allows the frontend's origin".

---

## 2. Backend — recommended host: Render (Railway/Fly.io are equally valid)

1. **Create the Postgres instance first.** Render → New → PostgreSQL (or Railway's Postgres plugin). Copy the external connection string.
2. **Create the Web Service** from this GitHub repo.
   - Build command: `npm ci && npx prisma generate && npm run build`
   - Start command: `npm run start`
3. **Set environment variables** in the host dashboard (never in the repo):

   | Var | Value |
   |---|---|
   | `DATABASE_URL` | connection string from step 1 |
   | `JWT_SECRET` | new random 32+ char secret — **not** the one from `.env.example` |
   | `JWT_EXPIRES_IN` | `7d` (or shorter, see §5) |
   | `PORT` | leave unset — most hosts inject their own and ignore yours; Render sets `PORT` itself |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | your live frontend URL(s), comma-separated, e.g. `https://mvep.vercel.app` |
   | `FRONTEND_URL` | your canonical live frontend URL, e.g. `https://mvep.vercel.app` — used to build the link in password-reset emails |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | production email provider (see §4) |
   | `EMAIL_FROM` | a verified sender address for that provider |

4. **Run migrations on every deploy**, not just once locally: add `npx prisma migrate deploy` as a Render "pre-deploy command" (or the first line of the start command). This applies committed migrations to the prod DB safely — it never generates new ones.
5. **Bootstrap the first admin account.** `scripts/admin.ts` is meant to be run outside the HTTP API:
   - Easiest: temporarily set `DATABASE_URL` in your local `.env` to the **production** connection string, run `npx ts-node scripts/admin.ts create "Your Name" you@email.com <password>`, then revert your local `.env`.
   - Alternative: use the host's one-off shell/job runner (Render "Shell", Railway `railway run`) against the deployed service.
6. **Confirm the health check.** `GET /` already returns `{ ok: true }` — point the host's health check at that path.

---

## 3. Frontend — recommended host: Vercel

1. Import the frontend repo into Vercel (auto-detects Vite).
2. Build command: `npm run build` (Vercel default for Vite is already correct — `vite build`).
3. Set project env vars in Vercel dashboard:

   | Var | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<your-backend>.onrender.com/api/v1` |
   | `VITE_MSW_ENABLED` | `false` (or whatever flag currently gates the MSW worker) |

4. **Verify MSW is actually excluded from the production bundle**, not just disabled at runtime — if `worker.start()` is still called behind a flag, that's fine, but double check the MSW service worker registration doesn't ship/register in prod (`public/mockServiceWorker.js` being present is harmless if never registered).
5. Add the custom domain (if any) in Vercel, then update `CORS_ORIGIN` on the backend to match it exactly (scheme + host, no trailing slash).

---

## 4. Email in production

Dev uses Mailtrap (sandbox, never actually delivers). For real users you need a real transactional provider before launch — Resend was the intended production choice per `project-spec.md`. Any SMTP-compatible provider works since `lib/email.ts` just uses `nodemailer` with host/port/user/pass — swap the four `SMTP_*` vars and `EMAIL_FROM`, no code change needed.

---

## 5. Pre-launch checklist

- [ ] `npm audit` — resolve or consciously accept any high/critical advisories.
- [ ] Confirm the managed Postgres plan has automatic backups enabled.
- [ ] Rotate `JWT_SECRET` to a fresh value — don't reuse anything that ever touched a `.env.example`, CI file, or local `.env`.
- [ ] Set `CORS_ORIGIN` to the real frontend domain (not `localhost`).
- [ ] Set up basic error visibility in prod (see backend fixes below — errors are now logged unconditionally; consider Sentry or the host's log tail as your first incident-response tool).
- [ ] Smoke-test the full flow against production once both sides are deployed: register → verify email → login → browse products → place an order → vendor dashboard → admin console → forgot password → reset link → log in with new password.

---

## 6. Post-launch

- Watch host logs for the first few days — that's your only signal until you wire up something like Sentry.
- Keep `prisma/migrations/` as the only way schema changes reach prod (`migrate deploy`, never `db push` against production).
- If traffic ever justifies a second backend instance, revisit the in-memory rate limiter (`express-rate-limit`) — it doesn't share state across instances and would need a Redis store at that point.
