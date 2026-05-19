import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import * as ordersController from './orders.controller';

const router = Router();

// Customer-only
router.get('/my', authenticate, requireRole('customer'), ordersController.listMyOrders);
router.post('/', authenticate, requireRole('customer'), ordersController.createOrder);

// Vendor/admin
router.get('/', authenticate, requireRole('vendor', 'admin'), ordersController.listOrders);
router.patch('/:id/status', authenticate, requireRole('vendor', 'admin'), ordersController.updateOrderStatus);

// Any authenticated role (ownership checked in service)
router.get('/:id', authenticate, ordersController.getOrder);

export { router as ordersRouter };
