const { BaseRepository } = require('../../core/base/base.repository');
const { Contact, CONTACT_STATUS } = require('../models/Contact.model');

const USER_PRESENCE_PROJECTION = 'username displayName avatar status';
const USER_CARD_PROJECTION = 'username displayName avatar bio status lastSeenAt';

class ContactRepository extends BaseRepository {
  constructor() {
    super(Contact);
  }

  /**
   * Find the contact document between any two users, regardless of who
   * sent the original request. Returns null if no relationship exists.
   */
  async findBetweenUsers(userId1, userId2) {
    return Contact.findOne({
      $or: [
        { requester: userId1, recipient: userId2 },
        { requester: userId2, recipient: userId1 },
      ],
    }).lean();
  }

  /**
   * All accepted contacts for a user, paginated.
   * Returns populated user documents so the caller gets display-ready data.
   */
  async getContacts(userId, { skip = 0, limit = 20 } = {}) {
    return Contact.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: CONTACT_STATUS.ACCEPTED,
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('requester', USER_CARD_PROJECTION)
      .populate('recipient', USER_CARD_PROJECTION)
      .lean();
  }

  async countContacts(userId) {
    return Contact.countDocuments({
      $or: [{ requester: userId }, { recipient: userId }],
      status: CONTACT_STATUS.ACCEPTED,
    });
  }

  /**
   * Pending requests that this user RECEIVED (their inbox).
   */
  async getPendingReceived(userId) {
    return Contact.find({ recipient: userId, status: CONTACT_STATUS.PENDING })
      .sort({ requestedAt: -1 })
      .populate('requester', USER_CARD_PROJECTION)
      .lean();
  }

  /**
   * Pending requests that this user SENT (their outbox).
   */
  async getPendingSent(userId) {
    return Contact.find({ requester: userId, status: CONTACT_STATUS.PENDING })
      .sort({ requestedAt: -1 })
      .populate('recipient', USER_CARD_PROJECTION)
      .lean();
  }

  /**
   * Returns IDs of users that have a blocking relationship with userId
   * (either direction). Used to exclude blocked users from search results
   * and presence broadcasts.
   */
  async findBlockedUserIds(userId) {
    const blocks = await Contact.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: CONTACT_STATUS.BLOCKED,
    })
      .select('requester recipient')
      .lean();

    return blocks.map((b) => {
      const reqId = b.requester.toString();
      const recId = b.recipient.toString();
      return reqId === userId.toString() ? recId : reqId;
    });
  }

  /**
   * Returns the raw IDs of a user's accepted contacts.
   * Used by presence handler to scope online/offline broadcasts.
   *
   * FUTURE: Cache this list in Redis with a short TTL (30s) to avoid
   * a DB query on every socket connect/disconnect.
   */
  async getContactIds(userId) {
    const contacts = await Contact.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: CONTACT_STATUS.ACCEPTED,
    })
      .select('requester recipient')
      .lean();

    return contacts.map((c) => {
      const reqId = c.requester.toString();
      const recId = c.recipient.toString();
      return reqId === userId.toString() ? recId : reqId;
    });
  }

  /**
   * Quick boolean: are these two users accepted contacts?
   */
  async isContact(userId1, userId2) {
    const exists = await Contact.exists({
      $or: [
        { requester: userId1, recipient: userId2 },
        { requester: userId2, recipient: userId1 },
      ],
      status: CONTACT_STATUS.ACCEPTED,
    });
    return !!exists;
  }

  /**
   * Quick boolean: has userId2 blocked userId1 (in either direction)?
   * Used before allowing a DM or profile view.
   */
  async isBlocked(userId1, userId2) {
    const exists = await Contact.exists({
      $or: [
        { requester: userId1, recipient: userId2 },
        { requester: userId2, recipient: userId1 },
      ],
      status: CONTACT_STATUS.BLOCKED,
    });
    return !!exists;
  }
}

const contactRepository = new ContactRepository();

module.exports = { contactRepository };
