const mongoose = require('mongoose');

const OTP_TYPES = Object.freeze({
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
});

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(OTP_TYPES),
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, type: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = { OTP, OTP_TYPES };
