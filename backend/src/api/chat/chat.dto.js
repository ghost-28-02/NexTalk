/**
 * Chat DTO — shapes the chat document for API responses.
 *
 * Avatar normalization:
 *   Backend stores avatar as { url, publicId } (object).
 *   All DTOs return avatar as a plain URL string so frontend components
 *   can use it directly in <img src={avatar}> without accessing .url.
 *
 * participants vs members:
 *   participants — flat user array matching the frontend mock shape:
 *                  [{ id, name, avatar, status }]
 *   members     — full member subdoc array with role/joinedAt/lastReadAt
 *                  (needed for group management UI)
 *   Both are included in the response.
 *
 * unreadCount / isPinned / isMuted:
 *   Per-member preferences — extracted from the current user's member entry.
 *   Require currentUserId to be passed in.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize avatar to a URL string (or null). */
function avatarUrl(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') return avatar;
  return avatar.url || null;
}

/** Shape a user subdoc for the participants array (matches mock/users.js). */
function toParticipantShape(user) {
  if (!user) return null;
  return {
    id:          user._id,
    name:        user.displayName || user.username,
    username:    user.username,
    avatar:      avatarUrl(user.avatar),
    status:      user.status || 'offline',
    lastSeenAt:  user.lastSeenAt || null,
  };
}

/** Shape the lastMessage preview (matches mock chat lastMessage). */
function toLastMessagePreview(msg) {
  if (!msg) return null;
  const sender = msg.sender;
  return {
    id:       msg._id,
    senderId: sender?._id?.toString() ?? sender?.toString() ?? null,
    content:  msg.isDeleted ? null : msg.content,
    type:     msg.type,
    status:   msg.status,
    createdAt: msg.createdAt,
  };
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

/**
 * @param {object} chat     — lean Chat document (populated)
 * @param {string} currentUserId — used to extract per-member unreadCount/isPinned/isMuted
 */
function toChatDTO(chat, currentUserId) {
  const isGroup = chat.type === 'group';
  const members = chat.members || [];

  // Find the current user's member entry to read personal preferences
  const myMember = members.find(
    (m) => m.user && m.user._id?.toString() === currentUserId?.toString()
  );

  // For DMs: derive name and avatar from the other participant
  let name   = chat.name;
  let avatar = avatarUrl(chat.avatar);

  if (!isGroup) {
    const other = members.find(
      (m) => m.user && m.user._id?.toString() !== currentUserId?.toString()
    );
    if (other?.user) {
      name   = other.user.displayName || other.user.username || 'Unknown';
      avatar = avatarUrl(other.user.avatar);
    }
  }

  // Flat participants array — matches mock `participants` field
  const participants = members
    .map((m) => toParticipantShape(m.user))
    .filter(Boolean);

  // Full member array — for group management (roles, joinedAt, etc.)
  const membersDTO = members.map((m) => ({
    user:        m.user ? toParticipantShape(m.user) : null,
    role:        m.role,
    joinedAt:    m.joinedAt,
    lastReadAt:  m.lastReadAt,
    isPinned:    m.isPinned  ?? false,
    isMuted:     m.isMuted   ?? false,
    unreadCount: m.unreadCount ?? 0,
  }));

  return {
    id:           chat._id,
    type:         chat.type,
    name:         name || 'Unnamed',
    avatar,
    description:  chat.description || '',

    // Flat participants list (mirrors mock/chats.js participants array)
    participants,

    // Full member list (needed for admin/role UI)
    members: membersDTO,

    // Per-member preferences (extracted for the current viewer)
    unreadCount:  myMember?.unreadCount  ?? 0,
    isPinned:     myMember?.isPinned     ?? false,
    isMuted:      myMember?.isMuted      ?? false,

    // Last message preview with senderId resolved
    lastMessage: toLastMessagePreview(chat.lastMessage),

    createdAt:  chat.createdAt,
    updatedAt:  chat.updatedAt,
  };
}

module.exports = { toChatDTO };
