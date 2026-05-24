/**
 * Contact DTOs — shape contact and request responses for the API layer.
 *
 * toContactDTO        — normalized accepted contact (other user + contactSince)
 * toIncomingRequestDTO — a pending request sent TO us (expose the requester)
 * toOutgoingRequestDTO — a pending request sent BY us (expose the recipient)
 * toRelationshipDTO   — relationship status object for the UI
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUserMiniDTO(user) {
  if (!user) return null;
  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: (function avatarUrl(avatar) {
      if (!avatar) return null;
      if (typeof avatar === 'string') return avatar;
      return avatar.url || null;
    })(user.avatar),
    bio: user.bio || '',
  };
}

// ─── Public DTOs ─────────────────────────────────────────────────────────────

/**
 * Normalize an accepted contact entry.
 * Input is the object already flattened by contact.service getContacts:
 *   { ...otherUserFields, contactSince, contactId }
 */
function toContactDTO(contact) {
  return {
    contactId: contact.contactId,
    id: contact._id,
    username: contact.username,
    displayName: contact.displayName || contact.username,
    avatar: (function avatarUrl(avatar) {
      if (!avatar) return null;
      if (typeof avatar === 'string') return avatar;
      return avatar.url || null;
    })(contact.avatar),
    bio: contact.bio || '',
    status: contact.status || 'offline',   // USER_STATUS (online/offline/away…)
    lastSeenAt: contact.lastSeenAt || null,
    contactSince: contact.contactSince,
  };
}

/**
 * A pending contact request that was sent TO the viewer.
 * Exposes the requester (the person who sent it).
 */
function toIncomingRequestDTO(contact) {
  return {
    requestId: contact._id,
    requester: toUserMiniDTO(contact.requester),
    requestedAt: contact.requestedAt,
  };
}

/**
 * A pending contact request sent BY the viewer.
 * Exposes the recipient (the person they sent it to).
 */
function toOutgoingRequestDTO(contact) {
  return {
    requestId: contact._id,
    recipient: toUserMiniDTO(contact.recipient),
    requestedAt: contact.requestedAt,
  };
}

/**
 * Relationship status between the viewer and another user.
 * Passthrough — service already returns the right shape; this adds
 * a consistent call site for future transformations.
 */
function toRelationshipDTO(relationship) {
  return {
    status: relationship.status,
    direction: relationship.direction || null,
    requestedAt: relationship.requestedAt || null,
    respondedAt: relationship.respondedAt || null,
    contactId: relationship.contactId || null,
  };
}

module.exports = {
  toContactDTO,
  toIncomingRequestDTO,
  toOutgoingRequestDTO,
  toRelationshipDTO,
};
