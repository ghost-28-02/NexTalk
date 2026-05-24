const { BaseRepository } = require('../../core/base/base.repository');
const { OTP } = require('../models/OTP.model');

class OTPRepository extends BaseRepository {
  constructor() {
    super(OTP);
  }

  async findLatestValid(email, type) {
    return OTP.findOne({
      email: email.toLowerCase(),
      type,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  async markUsed(id) {
    return OTP.findByIdAndUpdate(id, { usedAt: new Date() }, { new: true, lean: true });
  }

  /**
   * Find the most recent OTP for this email+type regardless of expiry or used status.
   * Used exclusively to enforce the per-email resend cooldown in auth.service.js —
   * if createdAt is < RESEND_COOLDOWN_MS ago, reject with RESEND_TOO_SOON.
   */
  async findLatestAny(email, type) {
    return OTP.findOne({
      email: email.toLowerCase(),
      type,
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  async deleteExpiredForEmail(email, type) {
    return OTP.deleteMany({
      email: email.toLowerCase(),
      type,
    });
  }
}

const otpRepository = new OTPRepository();

module.exports = { otpRepository };
