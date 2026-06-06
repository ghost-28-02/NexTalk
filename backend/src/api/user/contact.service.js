const { contactRepository } = require('../../database/repositories/contact.repository');
const { userRepository } = require('../../database/repositories/user.repository');
const { AppError } = require('../../core/errors/AppError');
const { ERROR_CODES } = require('../../core/errors/error.codes');
const { CONTACT_STATUS } = require('../../database/models/Contact.model');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');
const { createNotification } = require('../notification/notification.service');
const { toNotificationDTO } = require('../notification/notification.dto');
const { NOTIFICATION_EVENTS } = require('../../shared/constants/events');

/** Lazy emit — avoids circular import at module-load time. */
function tryEmit(room, event, data) {
  try {
    const { getIO } = require('../../sockets/socket.manager');
    getIO().to(room).emit(event, data);
  } catch { /* socket not yet initialised — safe to ignore */ }
}

/** Fetch a user's display name for notification copy. */
async function resolveUserName(userId) {
  try {
    const u = await userRepository.findById(userId, 'username displayName');
    return u?.displayName || u?.username || 'Someone';
  } catch { return 'Someone'; }
}

// ─── Send / Manage Requests ───────────────────────────────────────────────────

/**
 * Send a contact request.
 *
 * State machine:
 *   No existing relationship → create PENDING
 *   Existing REJECTED        → update back to PENDING (re-request allowed)
 *   Existing PENDING from the OTHER party → auto-ACCEPT (cross-request = both want contact)
 *   Existing PENDING from THIS party  → error (already sent)
 *   Existing ACCEPTED        → error (already contacts)
 *   Existing BLOCKED         → error (cannot request through a block)
 */
async function sendRequest(requesterId, recipientId) {
  if (requesterId.toString() === recipientId.toString()) {
    throw AppError.badRequest(
      'Cannot send a contact request to yourself',
      ERROR_CODES.SELF_ACTION_NOT_ALLOWED
    );
  }

  const recipient = await userRepository.findById(recipientId, 'isActive profileVisibility');
  if (!recipient || !recipient.isActive) throw AppError.notFound('User');

  const existing = await contactRepository.findBetweenUsers(requesterId, recipientId);

  if (existing) {
    switch (existing.status) {
      case CONTACT_STATUS.ACCEPTED:
        throw AppError.conflict('Already contacts', ERROR_CODES.ALREADY_CONTACTS);

      case CONTACT_STATUS.BLOCKED:
        // Don't reveal who did the blocking — generic message
        throw AppError.forbidden('Cannot send a request to this user', ERROR_CODES.USER_BLOCKED);

      case CONTACT_STATUS.PENDING: {
        // If the OTHER person already sent us a request, auto-accept (cross-request)
        const otherPersonSentIt = existing.recipient.toString() === requesterId.toString();
        if (otherPersonSentIt) {
          return contactRepository.updateOne(
            { _id: existing._id },
            { status: CONTACT_STATUS.ACCEPTED, respondedAt: new Date() }
          );
        }
        throw AppError.conflict(
          'Contact request already sent',
          ERROR_CODES.REQUEST_ALREADY_SENT
        );
      }

      case CONTACT_STATUS.REJECTED: {
        // Allow re-requesting after rejection — update the document so the
        // compound unique index doesn't block it.
        const updated = await contactRepository.updateOne(
          { _id: existing._id },
          {
            requester: requesterId,
            recipient: recipientId,
            status: CONTACT_STATUS.PENDING,
            requestedAt: new Date(),
            respondedAt: null,
          }
        );
        await _notifyContactRequest(requesterId, recipientId);
        return updated;
      }

      default:
        break;
    }
  }

  const contact = await contactRepository.create({
    requester: requesterId,
    recipient: recipientId,
    status: CONTACT_STATUS.PENDING,
    requestedAt: new Date(),
  });
  await _notifyContactRequest(requesterId, recipientId);
  return contact;
}

/**
 * Create + deliver a 'contact_request' notification to the recipient.
 * Fire-and-forget — failures are swallowed so they never block the HTTP response.
 */
async function _notifyContactRequest(requesterId, recipientId) {
  try {
    const senderName = await resolveUserName(requesterId);
    const raw = await createNotification({
      recipient: recipientId,
      sender:    requesterId,
      type:      'contact_request',
      title:     'Contact request',
      body:      `${senderName} sent you a contact request`,
      data:      { userId: requesterId.toString() },
    });
    const populated = await raw.populate('sender', 'username displayName avatar');
    tryEmit(`user:${recipientId.toString()}`, NOTIFICATION_EVENTS.NEW, {
      notification: toNotificationDTO(populated),
    });
  } catch (err) {
    // Non-fatal — log but don't rethrow
    console.error('[contact] _notifyContactRequest failed:', err?.message);
  }
}

/**
 * Accept a pending contact request.
 * Only the RECIPIENT of the request can accept it.
 */
async function acceptRequest(recipientId, requesterId) {
  const contact = await contactRepository.findBetweenUsers(requesterId, recipientId);

  if (!contact || contact.status !== CONTACT_STATUS.PENDING) {
    throw AppError.notFound('Contact request not found');
  }

  // Guard: only the recipient can accept — requesters cannot self-accept
  if (contact.recipient.toString() !== recipientId.toString()) {
    throw AppError.forbidden('You cannot accept a request you sent');
  }

  const accepted = await contactRepository.updateOne(
    { _id: contact._id },
    { status: CONTACT_STATUS.ACCEPTED, respondedAt: new Date() }
  );
  await _notifyContactAccepted(recipientId, requesterId);
  return accepted;
}

/**
 * Create + deliver a 'contact_accepted' notification to the original requester.
 */
async function _notifyContactAccepted(acceptorId, requesterId) {
  try {
    const acceptorName = await resolveUserName(acceptorId);
    const raw = await createNotification({
      recipient: requesterId,
      sender:    acceptorId,
      type:      'contact_accepted',
      title:     'Contact request accepted',
      body:      `${acceptorName} accepted your contact request`,
      data:      { userId: acceptorId.toString() },
    });
    const populated = await raw.populate('sender', 'username displayName avatar');
    tryEmit(`user:${requesterId.toString()}`, NOTIFICATION_EVENTS.NEW, {
      notification: toNotificationDTO(populated),
    });
  } catch (err) {
    console.error('[contact] _notifyContactAccepted failed:', err?.message);
  }
}

/**
 * Reject a pending contact request.
 * Only the RECIPIENT can reject. Status stays in DB as REJECTED so the
 * requester can later re-send after a reasonable period.
 */
async function rejectRequest(recipientId, requesterId) {
  const contact = await contactRepository.findBetweenUsers(requesterId, recipientId);

  if (!contact || contact.status !== CONTACT_STATUS.PENDING) {
    throw AppError.notFound('Contact request not found');
  }

  if (contact.recipient.toString() !== recipientId.toString()) {
    throw AppError.forbidden('You cannot reject a request you sent');
  }

  return contactRepository.updateOne(
    { _id: contact._id },
    { status: CONTACT_STATUS.REJECTED, respondedAt: new Date() }
  );
}

/**
 * Remove an accepted contact.
 * Either party can remove. The document is deleted entirely so either
 * party can send a fresh request in the future.
 */
async function removeContact(userId, contactId) {
  const contact = await contactRepository.findBetweenUsers(userId, contactId);

  if (!contact || contact.status !== CONTACT_STATUS.ACCEPTED) {
    throw AppError.notFound('Contact not found');
  }

  await contactRepository.deleteById(contact._id);
}

// ─── Block / Unblock ─────────────────────────────────────────────────────────

/**
 * Block a user.
 * Works from any relationship state — overwrites pending/accepted/rejected.
 * Records who initiated the block via `blockedBy` so only they can unblock.
 */
async function blockUser(blockerId, targetId) {
  if (blockerId.toString() === targetId.toString()) {
    throw AppError.badRequest('Cannot block yourself', ERROR_CODES.SELF_ACTION_NOT_ALLOWED);
  }

  const target = await userRepository.findById(targetId, 'isActive');
  if (!target) throw AppError.notFound('User');

  const existing = await contactRepository.findBetweenUsers(blockerId, targetId);

  if (existing) {
    // Already blocked by this user
    if (
      existing.status === CONTACT_STATUS.BLOCKED &&
      existing.blockedBy.toString() === blockerId.toString()
    ) {
      throw AppError.conflict('User is already blocked');
    }

    return contactRepository.updateOne(
      { _id: existing._id },
      { status: CONTACT_STATUS.BLOCKED, blockedBy: blockerId, respondedAt: new Date() }
    );
  }

  // No existing relationship — create a block document
  return contactRepository.create({
    requester: blockerId,
    recipient: targetId,
    status: CONTACT_STATUS.BLOCKED,
    blockedBy: blockerId,
    requestedAt: new Date(),
    respondedAt: new Date(),
  });
}

/**
 * Unblock a user.
 * Only the party who performed the block can unblock.
 * Document is deleted (clean slate — allows fresh requests after unblock).
 */
async function unblockUser(blockerId, targetId) {
  const contact = await contactRepository.findBetweenUsers(blockerId, targetId);

  if (
    !contact ||
    contact.status !== CONTACT_STATUS.BLOCKED ||
    contact.blockedBy.toString() !== blockerId.toString()
  ) {
    throw AppError.notFound('Block not found');
  }

  await contactRepository.deleteById(contact._id);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

async function getContacts(userId, queryParams = {}) {
  const { page, limit, skip } = parsePagination(queryParams);
  const [contacts, total] = await Promise.all([
    contactRepository.getContacts(userId, { skip, limit }),
    contactRepository.countContacts(userId),
  ]);

  // Normalize: expose the "other person" in each contact pair
  const normalized = contacts.map((c) => {
    const isRequester = c.requester._id.toString() === userId.toString();
    const other = isRequester ? c.recipient : c.requester;
    return { ...other, contactSince: c.updatedAt, contactId: c._id };
  });

  return { contacts: normalized, pagination: buildPaginationMeta(total, page, limit) };
}

async function getPendingRequests(userId) {
  const [received, sent] = await Promise.all([
    contactRepository.getPendingReceived(userId),
    contactRepository.getPendingSent(userId),
  ]);
  return { received, sent };
}

/**
 * Get the relationship status between the current user and another user.
 * Useful for the frontend to decide what action buttons to show.
 */
async function getRelationship(userId, targetId) {
  const contact = await contactRepository.findBetweenUsers(userId, targetId);
  if (!contact) return { status: 'none', direction: null };

  const isRequester = contact.requester.toString() === userId.toString();

  return {
    status: contact.status,
    direction: isRequester ? 'sent' : 'received',
    requestedAt: contact.requestedAt,
    respondedAt: contact.respondedAt,
    contactId: contact._id,
  };
}

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeContact,
  blockUser,
  unblockUser,
  getContacts,
  getPendingRequests,
  getRelationship,
};
