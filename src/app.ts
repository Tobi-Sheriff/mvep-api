import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.router';
import { productsRouter } from './modules/products/products.router';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productsRouter);
// app.use('/api/v1/orders',    ordersRouter);
// app.use('/api/v1/users',     usersRouter);
// app.use('/api/v1/analytics', analyticsRouter);
// app.use('/api/v1/admin',     adminRouter);

app.use(errorHandler);

export { app };
