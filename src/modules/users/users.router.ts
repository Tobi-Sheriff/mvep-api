import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import * as usersController from './users.controller';

const router = Router();

router.get('/profile', authenticate, usersController.getProfile);
router.put('/profile', authenticate, usersController.updateProfile);

router.get('/wishlist', authenticate, requireRole('customer'), usersController.getWishlist);
router.post('/wishlist/:productId', authenticate, requireRole('customer'), usersController.addToWishlist);
router.delete('/wishlist/:productId', authenticate, requireRole('customer'), usersController.removeFromWishlist);

export { router as usersRouter };
