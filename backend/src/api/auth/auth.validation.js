const signupSchema = {
  firstName: { required: true, minLength: 1, maxLength: 50 },
  lastName: { required: true, minLength: 1, maxLength: 50 },
  email: { required: true, type: 'email' },
  password: { required: true, minLength: 6, maxLength: 128 },
};

const loginSchema = {
  identifier: { required: true, minLength: 1 },
  password: { required: true, minLength: 1 },
};

const verifyOtpSchema = {
  email: { required: true, type: 'email' },
  otp: { required: true, minLength: 6, maxLength: 6 },
};

const resendVerificationSchema = {
  email: { required: true, type: 'email' },
};

const forgotPasswordSchema = {
  email: { required: true, type: 'email' },
};

const resetPasswordSchema = {
  token: { required: true, minLength: 10 },
  newPassword: { required: true, minLength: 6, maxLength: 128 },
};

module.exports = {
  signupSchema,
  loginSchema,
  verifyOtpSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
