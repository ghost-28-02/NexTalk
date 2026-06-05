const { BaseRepository } = require('../../core/base/base.repository');
const { Chat } = require('../models/Chat.model');

class ChatRepository extends BaseRepository {
  constructor() {
    super(Chat);
  }

  /**
   * Fetch a chat by ID with the same population as findUserChats.
   * Used when emitting chat:new_chat via socket after creation — the
   * socket payload must carry a fully populated DTO, not raw ObjectIds.
   */
  async findByIdPopulated(chatId) {
    return Chat.findById(chatId)
      .populate('members.user', 'username displayName avatar status lastSeenAt')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username displayName avatar' },
      })
      .lean();
  }

  /**
   * Find an existing direct chat between two users.
   *
   * Population is intentional: toChatDTO() needs m.user.displayName,
   * m.user.username, and m.user.avatar to build the chat name/avatar
   * for the sidebar. Without population, m.user is a raw ObjectId —
   * all property access returns undefined, producing "Unknown".
   */
  async findDirectChat(userId1, userId2) {
    return Chat.findOne({
      type: 'direct',
      'members.user': { $all: [userId1, userId2] },
      $expr: { $eq: [{ $size: '$members' }, 2] },
    })
      .populate('members.user', 'username displayName avatar status lastSeenAt')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username displayName avatar' },
      })
      .lean();
  }

  /**
   * Fetch all chats for a user, sorted by latest activity.
   * Populates member users (for participants list) and the lastMessage
   * document along with its sender (for the chat preview row).
   */
  async findUserChats(userId, { skip = 0, limit = 20 } = {}) {
    return Chat.find({ 'members.user': userId, isActive: true })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('members.user', 'username displayName avatar status lastSeenAt')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username displayName avatar',
        },
      })
      .lean();
  }

  async addMember(chatId, userId) {
    return Chat.findByIdAndUpdate(
      chatId,
      { $addToSet: { members: { user: userId, joinedAt: new Date() } } },
      { new: true, lean: true }
    );
  }

  async removeMember(chatId, userId) {
    return Chat.findByIdAndUpdate(
      chatId,
      { $pull: { members: { user: userId } } },
      { new: true, lean: true }
    );
  }

  async setLastMessage(chatId, messageId) {
    return Chat.findByIdAndUpdate(
      chatId,
      { lastMessage: messageId, updatedAt: new Date() },
      { new: true, lean: true }
    );
  }

  async updateLastRead(chatId, userId) {
    return Chat.findOneAndUpdate(
      { _id: chatId, 'members.user': userId },
      { $set: { 'members.$.lastReadAt': new Date() } },
      { new: true, lean: true }
    );
  }

  async isMember(chatId, userId) {
    const chat = await Chat.exists({ _id: chatId, 'members.user': userId });
    return !!chat;
  }

  /** Returns array of member user ObjectIds for a chat. */
  async getMemberIds(chatId) {
    const chat = await Chat.findById(chatId, 'members.user').lean();
    return (chat?.members ?? []).map((m) => m.user);
  }

  /**
   * Increment unreadCount for all members EXCEPT the sender.
   * Called in chat.handler.js every time a new message is sent via socket.
   */
  async incrementUnreadCount(chatId, senderUserId) {
    return Chat.updateOne(
      { _id: chatId },
      {
        $inc: { 'members.$[elem].unreadCount': 1 },
      },
      {
        arrayFilters: [
          { 'elem.user': { $ne: senderUserId } },
        ],
      }
    );
  }

  /**
   * Reset unreadCount to 0 for a specific member.
   * Called when the user marks the chat as read (markRead endpoint or message_read socket).
   */
  async resetUnreadCount(chatId, userId) {
    return Chat.updateOne(
      { _id: chatId, 'members.user': userId },
      { $set: { 'members.$.unreadCount': 0 } }
    );
  }

  /**
   * Toggle isPinned for a specific member.
   */
  async togglePinned(chatId, userId, isPinned) {
    return Chat.updateOne(
      { _id: chatId, 'members.user': userId },
      { $set: { 'members.$.isPinned': isPinned } }
    );
  }

  /**
   * Toggle isMuted for a specific member.
   */
  async toggleMuted(chatId, userId, isMuted) {
    return Chat.updateOne(
      { _id: chatId, 'members.user': userId },
      { $set: { 'members.$.isMuted': isMuted } }
    );
  }
}

const chatRepository = new ChatRepository();

module.exports = { chatRepository };
