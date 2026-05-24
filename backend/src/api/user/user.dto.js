/**
 * User DTOs — shape user documents for API responses.
 *
 * toUserDTO        — full profile for the owner (GET /me)
 * toUserPublicDTO  — public-safe profile for other authenticated users
 * toUserStubDTO    — minimal stub for contacts-only profiles viewed by non-contacts
 * toUserSearchDTO  — compact result shape for search results
 *
 * Avatar normalization:
 *   Backend stores avatar as { url, publicId }.
 *   All DTOs return avatar as a plain URL string so frontend components
 *   can use <img src={user.avatar}> without accessing .url.
 *
 * `name` field:
 *   Frontend components (chat list, contact list) use `user.name`.
 *   All public-facing DTOs include `name` as an alias for `displayName`.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveDisplayName(user) {
  const firstName = user.firstName || '';
  const lastName  = user.lastName  || '';
  return user.displayName || `${firstName} ${lastName}`.trim() || user.username;
}

/** Normalize avatar to a URL string (or null). */
function avatarUrl(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') return avatar;
  return avatar.url || null;
}

function normalizeSocialLinks(links) {
  if (!links || typeof links !== 'object') return {};
  const keys = ['website', 'github', 'twitter', 'instagram', 'linkedin'];
  const out = {};
  for (const k of keys) {
    out[k] = links[k] || '';
  }
  return out;
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

/**
 * Full profile — only returned to the authenticated owner (GET /me).
 * Includes private fields: email, role, settings, isEmailVerified.
 */
function toUserDTO(user) {
  const displayName = resolveDisplayName(user);
  return {
    id:           user._id,
    username:     user.username,
    email:        user.email,
    firstName:    user.firstName || '',
    lastName:     user.lastName  || '',
    displayName,
    name:         displayName,                        // ← alias (matches mock user.name)
    avatar:       avatarUrl(user.avatar),             // ← normalized to URL string
    bio:          user.bio || '',
    profileVisibility: user.profileVisibility || 'public',
    socialLinks:  normalizeSocialLinks(user.socialLinks),
    settings: {
      notifications: {
        messages:        user.settings?.notifications?.messages        ?? true,
        contactRequests: user.settings?.notifications?.contactRequests ?? true,
        calls:           user.settings?.notifications?.calls           ?? true,
      },
      privacy: {
        showLastSeen:       user.settings?.privacy?.showLastSeen       ?? true,
        showOnlineStatus:   user.settings?.privacy?.showOnlineStatus   ?? true,
      },
    },
    role:             user.role,
    isEmailVerified:  user.isEmailVerified,
    status:           user.status,
    lastSeenAt:       user.lastSeenAt,
    usernameChangedAt: user.usernameChangedAt || null,
    createdAt:        user.createdAt,
  };
}

/**
 * Public profile — safe to expose to any authenticated user.
 * Excludes: email, role, isEmailVerified, settings (private), usernameChangedAt.
 */
function toUserPublicDTO(user) {
  if (user._isStub) return toUserStubDTO(user);

  const displayName = resolveDisplayName(user);
  return {
    id:               user._id,
    username:         user.username,
    displayName,
    name:             displayName,                    // ← alias
    avatar:           avatarUrl(user.avatar),         // ← normalized
    bio:              user.bio || '',
    profileVisibility: user.profileVisibility || 'public',
    socialLinks:      normalizeSocialLinks(user.socialLinks),
    status:           user.status,
    lastSeenAt:       user.lastSeenAt || null,
    createdAt:        user.createdAt,
  };
}

/**
 * Minimal stub — returned when profileVisibility='contacts' and viewer
 * is not a contact. Enough for a username chip, nothing personal.
 */
function toUserStubDTO(user) {
  return {
    id:               user._id,
    username:         user.username,
    displayName:      user.displayName || user.username,
    name:             user.displayName || user.username, // ← alias
    avatar:           avatarUrl(user.avatar),
    profileVisibility: user.profileVisibility,
    _isStub:          true,
  };
}

/**
 * Compact search result — username, name, avatar only.
 * No status or social links — keeps search payloads small.
 */
function toUserSearchDTO(user) {
  const displayName = resolveDisplayName(user);
  return {
    id:          user._id,
    username:    user.username,
    displayName,
    name:        displayName,                         // ← alias
    avatar:      avatarUrl(user.avatar),              // ← normalized
    bio:         user.bio || '',
  };
}

module.exports = { toUserDTO, toUserPublicDTO, toUserStubDTO, toUserSearchDTO };
