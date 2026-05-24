const { chatRepository } = require('../../database/repositories/chat.repository');
const { userRepository } = require('../../database/repositories/user.repository');
const { AppError }       = require('../../core/errors/AppError');
const { ERROR_CODES }    = require('../../core/errors/error.codes');
const { CHAT_TYPES }     = require('../../database/models/Chat.model');
const { CHAT_EVENTS }    = require('../../shared/constants/events');
const { toChatDTO }      = require('./chat.dto');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');

/** Lazy getIO — avoids circular import at module-load time. */
function tryEmit(room, event, data) {
  try {
    const { getIO } = require('../../sockets/socket.manager');
    getIO().to(room).emit(event, data);
  } catch {
    // Socket not yet initialised (server boot) — safe to ignore
  }
}

async function getOrCreateDirectChat(currentUserId, targetUserId) {
  if (currentUserId.toString() === targetUserId.toString()) {
    throw AppError.badRequest('Cannot create a chat with yourself', ERROR_CODES.SELF_CHAT_NOT_ALLOWED);
  }

  const target = await userRepository.findById(targetUserId);
  if (!target) throw AppError.notFound('User');

  const existing = await chatRepository.findDirectChat(currentUserId, targetUserId);
  if (existing) return { chat: existing, isNew: false };

  const chat = await chatRepository.create({
    type: CHAT_TYPES.DIRECT,
    members: [
      { user: currentUserId, role: 'admin' },
      { user: targetUserId,  role: 'member' },
    ],
    createdBy: currentUserId,
  });

  // Notify the target user in realtime so their sidebar updates without
  // a refresh. We re-fetch the chat fully populated (same fields as
  // findUserChats) and shape the DTO from the target's perspective.
  try {
    const populated = await chatRepository.findByIdPopulated(chat._id);
    if (populated) {
      const targetDTO = toChatDTO(populated, targetUserId);
      tryEmit(`user:${targetUserId.toString()}`, CHAT_EVENTS.NEW_CHAT, { chat: targetDTO });
    }
  } catch {
    // Socket emission is best-effort — never block the HTTP response
  }

  return { chat, isNew: true };
}

async function createGroupChat(currentUserId, { name, memberIds, description }) {
  if (!name?.trim())     throw AppError.badRequest('Group name is required');
  if (!memberIds?.length) throw AppError.badRequest('At least one member is required');

  const uniqueIds = [...new Set([currentUserId.toString(), ...memberIds])];

  const members = uniqueIds.map((id) => ({
    user: id,
    role: id === currentUserId.toString() ? 'admin' : 'member',
  }));

  return chatRepository.create({
    type: CHAT_TYPES.GROUP,
    name: name.trim(),
    description: description?.trim(),
    members,
    createdBy: currentUserId,
  });
}

async function getUserChats(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const total = await chatRepository.count({ 'members.user': userId, isActive: true });
  const chats = await chatRepository.findUserChats(userId, { skip, limit });
  return { chats, pagination: buildPaginationMeta(total, page, limit) };
}

async function getChatById(chatId, userId) {
  const isMember = await chatRepository.isMember(chatId, userId);
  if (!isMember) throw AppError.forbidden('Not a member of this chat', ERROR_CODES.NOT_CHAT_MEMBER);

  const chat = await chatRepository.findById(chatId);
  if (!chat) throw AppError.notFound('Chat');
  return chat;
}

async function markRead(chatId, userId) {
  const isMember = await chatRepository.isMember(chatId, userId);
  if (!isMember) throw AppError.forbidden('Not a chat member', ERROR_CODES.NOT_CHAT_MEMBER);

  // Update lastReadAt and reset the unread counter in one go
  await Promise.all([
    chatRepository.updateLastRead(chatId, userId),
    chatRepository.resetUnreadCount(chatId, userId),
  ]);

  // Cross-device unread sync: push the zero count to all sockets for this user
  // (phone reads chat → desktop badge clears without a refetch)
  tryEmit(`user:${userId}`, CHAT_EVENTS.UNREAD_UPDATED, { chatId, unreadCount: 0 });
}

async function leaveChat(chatId, userId) {
  const chat = await chatRepository.findById(chatId);
  if (!chat) throw AppError.notFound('Chat');
  if (chat.type === CHAT_TYPES.DIRECT) throw AppError.badRequest('Cannot leave a direct chat');

  const isMember = chat.members.some((m) => m.user.toString() === userId.toString());
  if (!isMember) throw AppError.forbidden('Not a chat member', ERROR_CODES.NOT_CHAT_MEMBER);

  return chatRepository.removeMember(chatId, userId);
}

module.exports = {
  getOrCreateDirectChat,
  createGroupChat,
  getUserChats,
  getChatById,
  markRead,
  leaveChat,
};
