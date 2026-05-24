const authService = require('./auth.service');
const { toAuthUserDTO } = require('./auth.dto');
const { ApiResponse } = require('../../core/response/api.response');
const { asyncHandler } = require('../../shared/utils/async-handler');
const { jwtConfig } = require('../../config/jwt.config');
const { AppError } = require('../../core/errors/AppError');
const { ERROR_CODES } = require('../../core/errors/error.codes');
const { verifyRefreshToken } = require('../../shared/helpers/token.helper');

function getRequestMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

function setAuthCookies(res, tokens) {
  res.cookie(jwtConfig.refresh.cookieName, tokens.refreshToken, jwtConfig.refresh.cookieOptions);
  // nx_session is a presence flag — no sensitive data.
  // Readable by Next.js proxy.js (server-side) for route protection redirects.
  res.cookie(jwtConfig.session.cookieName, '1', jwtConfig.session.cookieOptions);
}

function clearAuthCookies(res) {
  res.clearCookie(jwtConfig.refresh.cookieName, { ...jwtConfig.refresh.cookieOptions, maxAge: 0 });
  res.clearCookie(jwtConfig.session.cookieName, { ...jwtConfig.session.cookieOptions, maxAge: 0 });
}

const signup = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const user = await authService.signup({ firstName, lastName, email, password });
  return ApiResponse.created(res, toAuthUserDTO(user), 'Account created. Please verify your email.');
});

const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const { user, tokens } = await authService.login({ identifier, password }, getRequestMeta(req));
  setAuthCookies(res, tokens);
  return ApiResponse.success(res, { user: toAuthUserDTO(user), accessToken: tokens.accessToken }, 'Login successful');
});

const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies[jwtConfig.refresh.cookieName];
  try {
    if (!rawToken) {
      throw AppError.unauthorized('No refresh token', ERROR_CODES.REFRESH_TOKEN_INVALID);
    }

    const { user, tokens } = await authService.refreshSession(rawToken, getRequestMeta(req));
    setAuthCookies(res, tokens);
    return ApiResponse.success(res, { user: toAuthUserDTO(user), accessToken: tokens.accessToken }, 'Token refreshed');
  } catch (error) {
    // Always clear stale cookies on any refresh failure so the client
    // gets a clean slate rather than retrying with an already-revoked token
    clearAuthCookies(res);
    throw error;
  }
});

/**
 * Logout — cookie-only, NO access token required.
 *
 * Why: access tokens expire every 15 minutes. Requiring a valid access token to
 * logout means users are stuck after token expiry — they have a valid refresh cookie
 * but the logout button is broken. Logout only needs to revoke the refresh token.
 */
const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies[jwtConfig.refresh.cookieName];
  // authService.logout is idempotent — safe to call with undefined/invalid token
  if (rawToken) await authService.logout(rawToken);
  clearAuthCookies(res);
  return ApiResponse.noContent(res);
});

/**
 * Logout all sessions — cookie-only, NO access token required.
 * Decodes the refresh token to get userId, revokes every session for that user.
 */
const logoutAll = asyncHandler(async (req, res) => {
  const rawToken = req.cookies[jwtConfig.refresh.cookieName];
  if (rawToken) {
    try {
      // verifyRefreshToken throws on expiry — but we still want to revoke all sessions
      // so wrap in try/catch and proceed regardless
      const decoded = verifyRefreshToken(rawToken);
      await authService.logoutAll(decoded.userId);
    } catch {
      // Token invalid/expired — cookies still get cleared below
    }
  }
  clearAuthCookies(res);
  return ApiResponse.noContent(res);
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  await authService.verifyEmail({ email, otp });
  return ApiResponse.success(res, null, 'Email verified successfully');
});

const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.resendVerification({ email });
  return ApiResponse.success(res, null, 'If your email is unverified, a new code was sent');
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.forgotPassword({ email });
  return ApiResponse.success(res, null, 'If that email exists, a reset link was sent');
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword({ token, newPassword });
  return ApiResponse.success(res, null, 'Password reset successfully. Please log in.');
});

const getMe = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, toAuthUserDTO(req.user));
});

module.exports = {
  signup,
  login,
  refresh,
  logout,
  logoutAll,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe,
};
