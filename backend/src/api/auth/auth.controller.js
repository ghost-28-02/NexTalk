const authService = require('./auth.service');
const { toAuthUserDTO } = require('./auth.dto');
const { ApiResponse } = require('../../core/response/api.response');
const { asyncHandler } = require('../../shared/utils/async-handler');
const { jwtConfig } = require('../../config/jwt.config');

function setAuthCookie(res, token) {
  res.cookie(jwtConfig.cookie.name, token, jwtConfig.cookie.options);
}

function clearAuthCookie(res) {
  res.clearCookie(jwtConfig.cookie.name, { ...jwtConfig.cookie.options, maxAge: 0 });
}

const signup = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const user = await authService.signup({ firstName, lastName, email, password });
  return ApiResponse.created(res, toAuthUserDTO(user), 'Account created. Please verify your email.');
});

const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const { user, token } = await authService.login({ identifier, password });
  setAuthCookie(res, token);
  // Also return token in body so the client can pass it to Socket.IO handshake.
  // Sockets connect directly to the backend and can't use the Next.js proxy,
  // so they can't rely on the cookie being present on the backend domain.
  return ApiResponse.success(res, { user: toAuthUserDTO(user), socketToken: token }, 'Login successful');
});

const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
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
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe,
};
