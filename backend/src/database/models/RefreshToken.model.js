const mongoose = require('mongoose');

/**
 * Stores sha256(jti) as tokenId for O(1) lookups.
 * Stores bcrypt(jti) as tokenHash for security-in-depth (per blueprint).
 * TTL index auto-expires stale tokens — no cron job needed.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
    },
    userAgent: String,
    ip: String,
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = { RefreshToken };
