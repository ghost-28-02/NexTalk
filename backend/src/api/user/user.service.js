const { userRepository } = require('../../database/repositories/user.repository');
const { contactRepository } = require('../../database/repositories/contact.repository');
const { uploadAvatar, deleteUpload } = require('../../shared/upload/upload.manager');
const { AppError } = require('../../core/errors/AppError');
const { ERROR_CODES } = require('../../core/errors/error.codes');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');
const { logger } = require('../../shared/utils/logger');

// Presence adapter — used for the status HTTP endpoint so it reads from
// the same in-memory store that socket handlers write to.
const presenceAdapter = require('../../sockets/adapters/memory.adapter');

// Username change cooldown: 3 days
const USERNAME_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

// ─── Profile ─────────────────────────────────────────────────────────────────

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw AppError.notFound('User');
  return user;
}

/**
 * Get a public profile by username.
 * Enforces profileVisibility:
 *   'private'  → 404 (does not reveal account existence)
 *   'contacts' → full data only if viewer is an accepted contact; else stub
 *   'public'   → full data for all authenticated users
 */
async function getByUsername(username, viewerId = null) {
  const user = await userRepository.findByUsername(username);
  if (!user) throw AppError.notFound('User');

  const isSelf = viewerId && user._id.toString() === viewerId.toString();

  if (!isSelf) {
    if (user.profileVisibility === 'private') {
      throw AppError.notFound('User'); // 404 — don't reveal account exists
    }

    if (user.profileVisibility === 'contacts' && viewerId) {
      const isContact = await contactRepository.isContact(viewerId, user._id);
      if (!isContact) {
        // Return a limited stub — enough to show the username but nothing personal
        return {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          profileVisibility: user.profileVisibility,
          _isStub: true,
        };
      }
    }
  }

  return user;
}

/** Lightweight raw lookup for the username availability check endpoint. */
async function getUserByUsernameRaw(username) {
  return userRepository.findByUsername(username);
}

async function getUserById(userId) {
  const user = await userRepository.findById(
    userId,
    'username displayName avatar bio status lastSeenAt profileVisibility'
  );
  if (!user) throw AppError.notFound('User');
  return user;
}

// ─── Editing ─────────────────────────────────────────────────────────────────

/**
 * Update display fields — displayName, bio, profileVisibility, socialLinks.
 *
 * socialLinks are expanded into dot-notation updates so MongoDB merges them
 * rather than replacing the whole object. This lets a user update just their
 * GitHub handle without wiping their Twitter link.
 */
async function updateProfile(userId, updates) {
  const allowed = ['displayName', 'bio', 'profileVisibility'];
  const sanitized = {};

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sanitized[key] = updates[key];
    }
  }

  // Expand socialLinks to dot-notation for partial updates
  if (updates.socialLinks && typeof updates.socialLinks === 'object') {
    const validKeys = ['website', 'github', 'twitter', 'instagram', 'linkedin'];
    for (const key of validKeys) {
      if (updates.socialLinks[key] !== undefined) {
        sanitized[`socialLinks.${key}`] = updates.socialLinks[key];
      }
    }
  }

  if (Object.keys(sanitized).length === 0) {
    throw AppError.badRequest('No valid fields to update');
  }

  const updated = await userRepository.updateById(userId, sanitized);

  // Broadcast only display-relevant changes to chat participants.
  // bio / profileVisibility / socialLinks are personal — own device syncs
  // via the personal room but chat rooms only need displayName.
  const broadcastChanges = {};
  if (sanitized.displayName !== undefined) broadcastChanges.displayName = sanitized.displayName;
  if (sanitized.bio !== undefined)         broadcastChanges.bio         = sanitized.bio;
  broadcastProfileUpdate(userId, broadcastChanges).catch(() => {});

  return updated;
}

/**
 * Update username with:
 *   - Format validation (handled by validate middleware — this double-checks)
 *   - Uniqueness check
 *   - 3-day cooldown between changes
 */
async function updateUsername(userId, newUsername) {
  const user = await userRepository.findById(userId, 'usernameChangedAt username');
  if (!user) throw AppError.notFound('User');

  // Cooldown check
  if (user.usernameChangedAt) {
    const elapsed = Date.now() - new Date(user.usernameChangedAt).getTime();
    if (elapsed < USERNAME_COOLDOWN_MS) {
      const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
      throw AppError.conflict(
        `Username can be changed again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        ERROR_CODES.USERNAME_COOLDOWN
      );
    }
  }

  // No-op if same username (saves the write + resets cooldown unnecessarily)
  if (user.username === newUsername) {
    return userRepository.findById(userId);
  }

  // Uniqueness check
  const existing = await userRepository.findByUsername(newUsername);
  if (existing) {
    throw AppError.conflict('Username already taken', ERROR_CODES.USERNAME_TAKEN);
  }

  const updated = await userRepository.updateUsername(userId, newUsername);

  // Username shown in chat participant lists / DM headers on other clients
  broadcastProfileUpdate(userId, { username: newUsername }).catch(() => {});

  return updated;
}

/**
 * Update privacy/notification settings.
 * Merges into the settings sub-document using dot-notation to avoid
 * overwriting sibling settings keys.
 */
async function updateSettings(userId, updates) {
  const sanitized = {};

  if (updates.notifications && typeof updates.notifications === 'object') {
    const allowed = ['messages', 'contactRequests', 'calls'];
    for (const key of allowed) {
      if (typeof updates.notifications[key] === 'boolean') {
        sanitized[`settings.notifications.${key}`] = updates.notifications[key];
      }
    }
  }

  if (updates.privacy && typeof updates.privacy === 'object') {
    const allowed = ['showLastSeen', 'showOnlineStatus'];
    for (const key of allowed) {
      if (typeof updates.privacy[key] === 'boolean') {
        sanitized[`settings.privacy.${key}`] = updates.privacy[key];
      }
    }
  }

  if (Object.keys(sanitized).length === 0) {
    throw AppError.badRequest('No valid settings to update');
  }

  return userRepository.updateById(userId, sanitized);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

/**
 * Upload a new avatar using the active storage adapter.
 * Deletes the old avatar from storage (non-fatal if it fails).
 */
async function updateAvatar(userId, file) {
  const user = await userRepository.findById(userId, 'avatar');
  if (!user) throw AppError.notFound('User');

  // Delete old avatar — use publicId so the correct adapter can clean up
  if (user.avatar?.publicId) {
    await deleteUpload(user.avatar.publicId).catch((err) =>
      logger.warn('[User] Failed to delete old avatar', { err: err.message, userId })
    );
  }

  const uploaded = await uploadAvatar(file, userId);

  const updated = await userRepository.updateById(userId, { avatar: uploaded });

  // Broadcast avatar change — avatarUrl (URL string only, no publicId) so every
  // connected chat participant and own device updates the avatar ring instantly.
  broadcastProfileUpdate(userId, { avatarUrl: uploaded.url }).catch(() => {});

  return updated;
}

// ─── Realtime profile sync ────────────────────────────────────────────────────

/**
 * Emit USER_EVENTS.PROFILE_UPDATED to every client that may display this user.
 *
 * Targets:
 *   user:{userId}   — personal room: cross-device sync for the user's own UI
 *   chat:{chatId}   — all chat rooms the user belongs to: other participants
 *                     update the sidebar entry, message headers, and DM chat name/avatar
 *
 * Design: fire-and-forget (called with .catch(() => {}) at each call site).
 * Uses lazy require() for socket.manager and Chat model to avoid circular deps
 * at module load time — these modules are guaranteed to be initialised by the
 * time any HTTP request reaches this service.
 *
 * @param {string|ObjectId} userId   — the user whose profile changed
 * @param {object}          changes  — only the changed, display-relevant fields
 */
async function broadcastProfileUpdate(userId, changes) {
  if (!changes || Object.keys(changes).length === 0) return;

  try {
    // Lazy-require to avoid circular dependency at module load
    const { getIO }       = require('../../sockets/socket.manager');
    const { USER_EVENTS } = require('../../shared/constants/events');
    const { Chat }        = require('../../database/models/Chat.model');

    const io      = getIO();
    const userStr = userId.toString();
    const payload = { userId: userStr, ...changes };

    // 1. Own other devices — full payload so authSlice.user stays in sync
    io.to(`user:${userStr}`).emit(USER_EVENTS.PROFILE_UPDATED, payload);

    // 2. All chat rooms — other participants update their local display of this user
    const chats = await Chat.find({ 'members.user': userId }, '_id').lean();
    for (const { _id: chatId } of chats) {
      io.to(chatId.toString()).emit(USER_EVENTS.PROFILE_UPDATED, payload);
    }
  } catch (err) {
    logger.warn('[User] broadcastProfileUpdate failed', { err: err.message });
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Paginated user search.
 * Excludes the current user and any users they have a blocking relationship with.
 */
async function searchUsers(query, currentUserId, queryParams = {}) {
  if (!query || query.trim().length < 2) {
    return { users: [], pagination: buildPaginationMeta(0, 1, 20) };
  }

  const { page, limit, skip } = parsePagination(queryParams);

  // Exclude blocked users in both directions
  const blockedIds = await contactRepository.findBlockedUserIds(currentUserId);

  const { users, total } = await userRepository.searchUsers(
    query.trim(),
    currentUserId,
    { skip, limit },
    blockedIds
  );

  return { users, pagination: buildPaginationMeta(total, page, limit) };
}

// ─── Presence ─────────────────────────────────────────────────────────────────

/**
 * Get the online/offline status of a user.
 * Reads from the in-memory presence adapter first (zero DB cost for online users).
 * Falls back to the DB lastSeenAt for offline users.
 *
 * Privacy: respects settings.privacy.showOnlineStatus.
 * If the user has hidden their online status, always returns 'offline' + lastSeenAt.
 */
async function getUserStatus(targetUserId, viewerId = null) {
  const user = await userRepository.findById(
    targetUserId,
    'status lastSeenAt settings profileVisibility'
  );
  if (!user) throw AppError.notFound('User');

  const isSelf = viewerId && user._id.toString() === viewerId.toString();

  // Respect showOnlineStatus setting (only hide from others, not self)
  const hideOnlineStatus = !isSelf && user.settings?.privacy?.showOnlineStatus === false;

  if (hideOnlineStatus) {
    return { userId: targetUserId, status: 'offline', lastSeenAt: null };
  }

  const isOnline = presenceAdapter.isUserOnline(targetUserId.toString());

  return {
    userId: targetUserId,
    status: isOnline ? 'online' : 'offline',
    lastSeenAt: isOnline ? null : user.lastSeenAt,
  };
}

module.exports = {
  getProfile,
  getByUsername,
  getUserByUsernameRaw,
  getUserById,
  updateProfile,
  updateUsername,
  updateSettings,
  updateAvatar,
  searchUsers,
  getUserStatus,
};
