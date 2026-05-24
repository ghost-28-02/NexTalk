/**
 * DTOs sanitize what goes into responses — controllers never return raw DB docs.
 * This keeps API shape stable even when models change internally.
 *
 * toAuthUserDTO is used for login, refresh, and /auth/me responses.
 * It intentionally includes all fields the frontend needs on first mount
 * (role, isEmailVerified, firstName/lastName for the profile header) so the
 * client doesn't need a second /users/me call just to render the layout.
 */

function toAuthUserDTO(user) {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';

  function avatarUrl(avatar) {
    if (!avatar) return null;
    if (typeof avatar === 'string') return avatar;
    return avatar.url || null;
  }

  return {
    id: user._id,
    username: user.username,
    email: user.email,
    firstName,
    lastName,
    // Fallback chain: stored displayName → firstName + lastName → username
    // Handles legacy/existing users that don't yet have a displayName in the DB
    displayName: user.displayName || `${firstName} ${lastName}`.trim() || user.username,
    avatar: avatarUrl(user.avatar),
    bio: user.bio || '',
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    status: user.status,
    createdAt: user.createdAt,
  };
}

module.exports = { toAuthUserDTO };
