const crypto = require('crypto');
const { BaseRepository } = require('../../core/base/base.repository');
const { PasswordResetToken } = require('../models/PasswordResetToken.model');

class PasswordResetTokenRepository extends BaseRepository {
  constructor() {
    super(PasswordResetToken);
  }

  _hash(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  async createForUser(userId, rawToken) {
    const tokenId = this._hash(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return PasswordResetToken.create({ tokenId, userId, expiresAt });
  }

  async findByRawToken(rawToken) {
    const tokenId = this._hash(rawToken);
    return PasswordResetToken.findOne({
      tokenId,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).lean();
  }

  async markUsed(id) {
    return PasswordResetToken.findByIdAndUpdate(id, { usedAt: new Date() }, { new: true, lean: true });
  }

  async deleteAllForUser(userId) {
    return PasswordResetToken.deleteMany({ userId });
  }
}

const passwordResetTokenRepository = new PasswordResetTokenRepository();

module.exports = { passwordResetTokenRepository };
