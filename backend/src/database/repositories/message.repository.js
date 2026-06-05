const { BaseRepository } = require('../../core/base/base.repository');
const { Message } = require('../models/Message.model');

class MessageRepository extends BaseRepository {
  constructor() {
    super(Message);
  }

  /**
   * Cursor-based message pagination — stable under concurrent realtime inserts.
   *
   * Strategy: sort by _id descending (ObjectId embeds timestamp, so _id order = time order).
   *   Initial load:   no `before` → returns the most-recent `limit` messages
   *   Load older:     `before` = oldest loaded _id → returns next page of older messages
   *
   * Returns `limit+1` rows internally to determine `hasMore` without a COUNT query.
   * `nextCursor` is the _id of the oldest returned message — pass as `before` for the next page.
   * Messages are reversed before returning so the array is oldest→newest for the UI.
   *
   * @param {string} chatId
   * @param {{ before?: string, limit?: number }} opts
   */
  async findChatMessages(chatId, { before = null, limit = 50 } = {}) {
    const filter = { chat: chatId, isDeleted: false };
    if (before) filter._id = { $lt: before }; // fetch messages older than cursor

    const raw = await Message.find(filter)
      .sort({ _id: -1 })           // newest first, then reverse below
      .limit(limit + 1)            // +1 to detect hasMore without COUNT
      .populate('sender', 'username displayName avatar')
      .populate('replyTo', 'content sender type')
      .lean();

    const hasMore = raw.length > limit;
    const items   = hasMore ? raw.slice(0, limit) : raw;

    // Reverse so array is oldest → newest (correct chronological order for UI)
    items.reverse();

    return {
      messages:   items,
      hasMore,
      nextCursor: hasMore ? items[0]._id : null, // oldest item = next cursor for "load older"
    };
  }

  /**
   * Update message content (edit). Only the original sender can edit.
   * Returns the populated updated document, or null if not found / not owner.
   */
  async updateMessage(messageId, userId, content) {
    return Message.findOneAndUpdate(
      { _id: messageId, sender: userId, isDeleted: false },
      { $set: { content, updatedAt: new Date() } },
      { new: true, lean: true }
    )
      .populate('sender', 'username displayName avatar')
      .populate('replyTo', 'content sender type');
  }

  async softDelete(messageId, userId) {
    return Message.findOneAndUpdate(
      { _id: messageId, sender: userId },
      { isDeleted: true, deletedAt: new Date(), content: null },
      { new: true, lean: true }
    );
  }

  async addReaction(messageId, userId, emoji) {
    return Message.findByIdAndUpdate(
      messageId,
      {
        $pull: { reactions: { user: userId } },
      },
      { new: false }
    ).then(() =>
      Message.findByIdAndUpdate(
        messageId,
        { $push: { reactions: { user: userId, emoji } } },
        { new: true, lean: true }
      )
    );
  }

  async removeReaction(messageId, userId) {
    return Message.findByIdAndUpdate(
      messageId,
      { $pull: { reactions: { user: userId } } },
      { new: true, lean: true }
    );
  }

  async bulkUpdateStatus(messageIds, status) {
    return Message.updateMany(
      { _id: { $in: messageIds } },
      { $set: { status } }
    );
  }

  /** Mark all unread messages in a chat as read (called when user opens the chat). */
  async markAllReadInChat(chatId, readerUserId) {
    return Message.updateMany(
      {
        chat:      chatId,
        sender:    { $ne: readerUserId }, // don't update own messages
        status:    { $ne: 'read' },
        isDeleted: false,
      },
      { $set: { status: 'read' } }
    );
  }
}

const messageRepository = new MessageRepository();

module.exports = { messageRepository };
