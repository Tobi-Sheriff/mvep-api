import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate';
import * as authController from './auth.controller';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Tighter cap on endpoints that send a real email each time they're hit.
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/register', authLimiter, authController.register);
router.post('/verify-email', authLimiter, authController.verifyEmail);
router.post('/resend-verification', emailLimiter, authController.resendVerification);
router.post('/login', authLimiter, authController.login);
router.post('/forgot-password', emailLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export { router as authRouter };
