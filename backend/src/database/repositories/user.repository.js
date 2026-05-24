const { BaseRepository } = require('../../core/base/base.repository');
const { User } = require('../models/User.model');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email, withPassword = false) {
    const query = User.findOne({ email: email.toLowerCase() });
    if (withPassword) query.select('+password');
    return query.lean();
  }

  async findByUsername(username) {
    return User.findOne({ username: username.toLowerCase() }).lean();
  }

  async findByEmailOrUsername(identifier) {
    return User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() },
      ],
    })
      .select('+password')
      .lean();
  }

  async updateStatus(userId, status) {
    return User.findByIdAndUpdate(
      userId,
      { status, lastSeenAt: new Date() },
      { new: true, lean: true }
    );
  }

  /**
   * Paginated user search by username or displayName.
   *
   * Security: `query` is escaped before building the regex to prevent
   * ReDoS / injection (e.g., input ".*" would match everything without escaping).
   *
   * Email is intentionally excluded from $or — users should not be discoverable
   * by other users' email addresses.
   *
   * @param {string}   query        — raw search input (min 2 chars enforced by service)
   * @param {ObjectId} excludeId    — current user (always excluded from results)
   * @param {object}   pagination   — { skip, limit }
   * @param {string[]} excludeIds   — additional user IDs to exclude (e.g., blocked users)
   */
  async searchUsers(query, excludeId, { skip = 0, limit = 20 } = {}, excludeIds = []) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const filter = {
      _id: { $nin: [excludeId, ...excludeIds] },
      isActive: true,
      $or: [{ username: regex }, { displayName: regex }],
    };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('username displayName avatar bio status')
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return { users, total };
  }

  /**
   * Update username and stamp usernameChangedAt atomically.
   * Callers are responsible for pre-checking uniqueness and cooldown.
   */
  async updateUsername(userId, username) {
    return User.findByIdAndUpdate(
      userId,
      { username, usernameChangedAt: new Date() },
      { new: true, lean: true }
    );
  }
}

// Singleton — repositories are stateless query objects, no need for multiple instances
const userRepository = new UserRepository();

module.exports = { userRepository };
