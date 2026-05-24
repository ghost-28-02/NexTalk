const { BaseRepository } = require('../../core/base/base.repository');
const { RefreshToken } = require('../models/RefreshToken.model');

class RefreshTokenRepository extends BaseRepository {
  constructor() {
    super(RefreshToken);
  }

  async findByTokenId(tokenId) {
    return RefreshToken.findOne({ tokenId }).select('+tokenHash').lean();
  }

  async revokeByTokenId(tokenId) {
    return RefreshToken.deleteOne({ tokenId });
  }

  async revokeAllForUser(userId) {
    return RefreshToken.deleteMany({ userId });
  }

  async countActiveSessions(userId) {
    return RefreshToken.countDocuments({
      userId,
      expiresAt: { $gt: new Date() },
    });
  }
}

const refreshTokenRepository = new RefreshTokenRepository();

module.exports = { refreshTokenRepository };
