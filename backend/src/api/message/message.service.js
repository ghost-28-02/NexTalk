const { messageRepository } = require('../../database/repositories/message.repository');
const { chatRepository }    = require('../../database/repositories/chat.repository');
const { AppError }          = require('../../core/errors/AppError');
const { ERROR_CODES }       = require('../../core/errors/error.codes');
const { MESSAGE_TYPES }     = require('../../database/models/Message.model');
const { CHAT_EVENTS }       = require('../../shared/constants/events');
const { uploadMedia, validateImageFile, validateVideoFile } = require('../../shared/helpers/file.helper');
const supabaseAdapter = require('../../shared/upload/adapters/supabase.adapter');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertChatMember(chatId, userId) {
  const isMember = await chatRepository.isMember(chatId, userId);
  if (!isMember) throw AppError.forbidden('Not a member of this chat', ERROR_CODES.NOT_CHAT_MEMBER);
}

/** Lazy-import getIO to avoid circular dependency at module load time. */
function tryEmit(room, event, data) {
  try {
    const { getIO } = require('../../sockets/socket.manager');
    getIO().to(room).emit(event, data);
  } catch {
    // Socket not yet initialised (server boot) — safe to ignore
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

async function sendMessage(senderId, chatId, { content, type = MESSAGE_TYPES.TEXT, replyTo, media }) {
  await assertChatMember(chatId, senderId);

  if (!content && !media) throw AppError.badRequest('Message must have content or media');

  const message = await messageRepository.create({
    chat: chatId,
    sender: senderId,
    type,
    content: content?.trim(),
    replyTo,
    media,
  });

  await chatRepository.setLastMessage(chatId, message._id);

  return message;
}

/**
 * Detect message type from MIME type.
 *   image/*  → IMAGE  (Cloudinary)
 *   video/*  → VIDEO  (Cloudinary)
 *   audio/*  → AUDIO  (Cloudinary)
 *   anything else → FILE (Supabase Storage)
 */
function detectTypeAndProvider(mimetype) {
  if (mimetype?.startsWith('image/')) return { type: MESSAGE_TYPES.IMAGE, useSupabase: false };
  if (mimetype?.startsWith('video/')) return { type: MESSAGE_TYPES.VIDEO, useSupabase: false };
  if (mimetype?.startsWith('audio/')) return { type: MESSAGE_TYPES.AUDIO, useSupabase: false };
  return { type: MESSAGE_TYPES.FILE, useSupabase: true };
}

async function sendMediaMessage(senderId, chatId, file) {
  await assertChatMember(chatId, senderId);

  const { type: messageType, useSupabase } = detectTypeAndProvider(file.mimetype);

  let uploaded;

  if (useSupabase) {
    // Documents (PDF, Word, Excel, ZIP, etc.) → Supabase Storage
    uploaded = await supabaseAdapter.upload(file.tempFilePath, {
      originalName: file.name,
      mimeType:     file.mimetype,
    });
  } else {
    // Images, videos, audio → Cloudinary (CDN + transforms)
    uploaded = await uploadMedia(file.tempFilePath, 'messages');
  }

  return sendMessage(senderId, chatId, {
    type: messageType,
    media: {
      url:      uploaded.url,
      publicId: uploaded.publicId,
      mimeType: file.mimetype,
      size:     file.size,
      name:     file.name,
    },
  });
}

/**
 * Cursor-based message fetch.
 *   ?before={messageId}  → load older messages (infinite scroll upward)
 *   ?limit={n}           → page size (default 50, max 100)
 *
 * Returns: { messages, hasMore, nextCursor }
 */
async function getChatMessages(userId, chatId, query) {
  await assertChatMember(chatId, userId);

  const { before } = query;
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));

  return messageRepository.findChatMessages(chatId, { before, limit });
}

/**
 * Edit a text message. Only the original sender may edit.
 * Broadcasts chat:message_edited to the chat room so all connected clients
 * update their local state without a refetch.
 */
async function editMessage(userId, messageId, { content }) {
  if (!content?.trim()) throw AppError.badRequest('Message content cannot be empty');

  const existing = await messageRepository.findById(messageId);
  if (!existing) throw AppError.notFound('Message');

  if (existing.sender.toString() !== userId.toString()) {
    throw AppError.forbidden('Cannot edit another user\'s message', ERROR_CODES.MESSAGE_NOT_OWNER);
  }
  if (existing.type !== MESSAGE_TYPES.TEXT) {
    throw AppError.badRequest('Only text messages can be edited');
  }

  const updated = await messageRepository.updateMessage(messageId, userId, content.trim());
  if (!updated) throw AppError.notFound('Message');

  // Broadcast edit to all clients in the room (no extra DB round-trip for them)
  const { toMessageDTO } = require('./message.dto');
  tryEmit(updated.chat.toString(), CHAT_EVENTS.MESSAGE_EDITED, {
    chatId:  updated.chat.toString(),
    message: toMessageDTO(updated),
  });

  return updated;
}

async function deleteMessage(userId, messageId) {
  const message = await messageRepository.findById(messageId);
  if (!message) throw AppError.notFound('Message');
  if (message.sender.toString() !== userId.toString()) {
    throw AppError.forbidden('Cannot delete another user\'s message', ERROR_CODES.MESSAGE_NOT_OWNER);
  }

  const deleted = await messageRepository.softDelete(messageId, userId);

  // Broadcast deletion so other clients hide the message immediately
  if (deleted) {
    tryEmit(deleted.chat.toString(), CHAT_EVENTS.MESSAGE_DELETED, {
      chatId:    deleted.chat.toString(),
      messageId: deleted._id.toString(),
    });
  }

  return deleted;
}

async function addReaction(userId, messageId, emoji) {
  const message = await messageRepository.findById(messageId);
  if (!message) throw AppError.notFound('Message');
  await assertChatMember(message.chat.toString(), userId);
  return messageRepository.addReaction(messageId, userId, emoji);
}

async function removeReaction(userId, messageId) {
  const message = await messageRepository.findById(messageId);
  if (!message) throw AppError.notFound('Message');
  return messageRepository.removeReaction(messageId, userId);
}

module.exports = {
  sendMessage,
  sendMediaMessage,
  getChatMessages,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
};
