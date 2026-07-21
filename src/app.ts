import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.router';
import { productsRouter } from './modules/products/products.router';
import { ordersRouter } from './modules/orders/orders.router';
import { usersRouter } from './modules/users/users.router';
import { analyticsRouter } from './modules/analytics/analytics.router';
import { adminRouter } from './modules/admin/admin.router';

const app = express();

// Required for correct client IPs (and therefore correct rate limiting) behind
// a platform reverse proxy (Render/Railway/Fly/etc.) in production.
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const corsOrigins = config.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/admin', adminRouter);

app.use(errorHandler);

export { app };
