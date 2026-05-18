import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as authController from './auth.controller';

const router = Router();

router.post('/register', authController.register);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export { router as authRouter };
