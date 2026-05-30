const { Router } = require('express');
const controller = require('./auth.controller');
const { validate } = require('../../core/middleware/validate.middleware');
const { protect } = require('../../core/middleware/auth.middleware');
const { authRateLimiter } = require('../../core/middleware/rate-limit.middleware');
const {
  signupSchema,
  loginSchema,
  verifyOtpSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth.validation');

const router = Router();

// Public — no auth required
router.post('/signup', authRateLimiter, validate(signupSchema), controller.signup);
router.post('/login', authRateLimiter, validate(loginSchema), controller.login);
router.post('/verify-email', validate(verifyOtpSchema), controller.verifyEmail);
router.post('/resend-verification', authRateLimiter, validate(resendVerificationSchema), controller.resendVerification);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), controller.resetPassword);

// Protected — JWT cookie required
router.post('/logout', protect, controller.logout);
router.get('/me', protect, controller.getMe);

module.exports = router;
