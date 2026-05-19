import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import * as adminController from './admin.controller';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get('/stats', adminController.getPlatformStats);
adminRouter.get('/users', adminController.listUsers);
adminRouter.get('/users/:id', adminController.getUser);
adminRouter.patch('/users/:id/status', adminController.updateUserStatus);
adminRouter.get('/vendors', adminController.listVendors);
adminRouter.get('/orders', adminController.listAllOrders);
adminRouter.get('/analytics/revenue', adminController.getPlatformRevenueSeries);
