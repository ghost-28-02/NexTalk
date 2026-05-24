const { Router } = require('express');
const controller = require('./auth.controller');
const { validate } = require('../../core/middleware/validate.middleware');
const { protect } = require('../../core/middleware/auth.middleware');
const { authRateLimiter, refreshRateLimiter } = require('../../core/middleware/rate-limit.middleware');
const {
  signupSchema,
  loginSchema,
  verifyOtpSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth.validation');

const router = Router();

// Public — no auth token required
router.post('/signup', authRateLimiter, validate(signupSchema), controller.signup);
router.post('/login', authRateLimiter, validate(loginSchema), controller.login);
router.post('/refresh', refreshRateLimiter, controller.refresh);
router.post('/verify-email', validate(verifyOtpSchema), controller.verifyEmail);
router.post('/resend-verification', authRateLimiter, validate(resendVerificationSchema), controller.resendVerification);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), controller.resetPassword);

// Cookie-only — refresh token in cookie is enough, no access token required.
// This means logout works even after the 15-minute access token has expired.
router.post('/logout', controller.logout);
router.post('/logout-all', controller.logoutAll);

// Protected — access token required
router.get('/me', protect, controller.getMe);

module.exports = router;
