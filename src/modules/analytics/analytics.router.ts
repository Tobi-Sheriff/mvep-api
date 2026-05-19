import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import * as analyticsController from './analytics.controller';

const router = Router();

router.use(authenticate, requireRole('vendor', 'admin'));

router.get('/overview', analyticsController.getOverview);
router.get('/revenue', analyticsController.getRevenueSeries);
router.get('/products/top', analyticsController.getTopProducts);

export { router as analyticsRouter };
