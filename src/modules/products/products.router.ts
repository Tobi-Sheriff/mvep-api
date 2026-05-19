import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import * as productsController from './products.controller';

const router = Router();

router.get('/', productsController.listProducts);
router.get('/:id/reviews', productsController.getProductReviews);
router.get('/:id', productsController.getProduct);

router.post('/', authenticate, requireRole('vendor', 'admin'), productsController.createProduct);
router.put('/:id', authenticate, requireRole('vendor', 'admin'), productsController.updateProduct);
router.delete('/:id', authenticate, requireRole('vendor', 'admin'), productsController.deleteProduct);

export { router as productsRouter };
