const { chatRepository }    = require('../../database/repositories/chat.repository');
const { messageRepository } = require('../../database/repositories/message.repository');
const { CHAT_EVENTS }       = require('../../shared/constants/events');
const { MESSAGE_TYPES }     = require('../../database/models/Message.model');
const { NOTIFICATION_TYPES } = require('../../database/models/Notification.model');
const { CHAT_TYPES, Chat }  = require('../../database/models/Chat.model');
const { createNotification } = require('../../api/notification/notification.service');
const { deliverNotification } = require('./notification.handler');
const { toNotificationDTO }  = require('../../api/notification/notification.dto');
const { logger }             = require('../../shared/utils/logger');

/**
 * Chat socket handler.
 *
 * Room strategy:
 *   chat:{chatId}  — conversation room (joined via JOIN_ROOM event)
 *   user:{userId}  — personal room (joined on connect in socket.manager.js)
 *
 * Delivery state rules:
 *   Direct chats  → full sent → delivered → read lifecycle
 *   Group chats   → sent → read only (skips delivery acks — too noisy at scale)
 *
 * Notification strategy:
 *   When a message is sent, any non-sender member NOT currently in the
 *   chat:{chatId} room receives a Notification document + realtime push.
 *
 * FUTURE [Redis]: Socket.IO Redis adapter broadcasts room emits across instances
 * automatically — no handler code changes required.
 */

const TYPING_TIMEOUT_MS = 6000; // 6 s safety net for crash / network loss

// ─── Helper: build wire-safe message shape from an unpopulated create() result ──
// messageRepository.create() returns doc.toObject() — sender is just an ObjectId.
// socket.user IS the full user, so we build the DTO inline without an extra DB call.

function buildMessagePayload(message, senderUser) {
  const avatar = senderUser.avatar?.url ?? senderUser.avatar ?? null;
  return {
    id:        message._id,
    chat:      message.chat,
    senderId:  senderUser._id.toString(),
    sender: {
      id:          senderUser._id,
      username:    senderUser.username,
      name:        senderUser.displayName || senderUser.username,
      displayName: senderUser.displayName,
      avatar,
    },
    type:      message.type,
    content:   message.content,
    media:     message.media   || null,
    replyTo:   message.replyTo || null,
    reactions: [],
    status:    message.status,
    isDeleted: false,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

// ─── Helper: push lastMessage update to members not in the chat room ─────────
//
// Why this exists:
//   Users who are online but viewing a DIFFERENT chat are not in the
//   `chat:{chatId}` socket room, so they never receive MESSAGE_SENT.
//   Without this, their sidebar would not update: no last-message preview,
//   no conversation reordering, and the unread badge would only come from
//   the notification:new event (which carries no full message payload).
//
//   We emit CHAT_UPDATED → `user:{userId}` (personal room) so every device
//   belonging to that user gets the update regardless of which chat room
//   they happen to have joined.
//
//   The frontend reducer updates lastMessage and re-sorts the sidebar,
//   producing WhatsApp-like "chat bubbles to the top" behaviour.
//   unreadCount is NOT included here — notification:new (chatUnreadIncremented)
//   is the single source of truth for the badge so there is no double-counting.

function pushChatUpdated(io, chat, message, senderUser) {
  const chatId   = chat._id.toString();
  const senderId = senderUser._id.toString();

  const lastMessage = {
    id:        message._id,
    senderId,
    content:   message.content,
    type:      message.type,
    status:    message.status,
    createdAt: message.createdAt,
  };

  const roomSocketIds = io.sockets.adapter.rooms.get(chatId) ?? new Set();
  const usersInRoom   = new Set();
  for (const sid of roomSocketIds) {
    const s = io.sockets.sockets.get(sid);
    if (s?.user?._id) usersInRoom.add(s.user._id.toString());
  }

  for (const { user: memberId } of chat.members) {
    const memberIdStr = memberId.toString();
    if (memberIdStr === senderId || usersInRoom.has(memberIdStr)) continue;
    io.to(`user:${memberIdStr}`).emit(CHAT_EVENTS.CHAT_UPDATED, { chatId, lastMessage });
  }
}

// ─── Helper: notify members not in the chat room ──────────────────────────────

async function notifyOfflineMembers(io, chat, message, senderUser) {
  const chatId     = chat._id.toString();
  const senderId   = senderUser._id.toString();
  const senderName = senderUser.displayName || senderUser.username;
  const chatName   = chat.type === CHAT_TYPES.GROUP ? chat.name : senderName;
  const preview    =
    message.content?.length > 60
      ? message.content.slice(0, 60) + '…'
      : message.content || 'Sent a file';

  const roomSocketIds = io.sockets.adapter.rooms.get(chatId) ?? new Set();
  const usersInRoom   = new Set();
  for (const sid of roomSocketIds) {
    const s = io.sockets.sockets.get(sid);
    if (s?.user?._id) usersInRoom.add(s.user._id.toString());
  }

  const targets = chat.members.filter((m) => {
    const memberId = m.user.toString();
    return memberId !== senderId && !usersInRoom.has(memberId);
  });

  await Promise.all(
    targets.map(async ({ user: memberId }) => {
      try {
        const notification = await createNotification({
          recipient: memberId.toString(),
          sender:    senderId,
          type:      NOTIFICATION_TYPES.MESSAGE,
          title:     chatName,
          body:      preview,
          data:      { chatId, messageId: message._id.toString() },
        });
        deliverNotification(io, memberId.toString(), toNotificationDTO(notification));
      } catch (err) {
        logger.warn('[Chat] notification create failed', { memberId, err: err.message });
      }
    })
  );
}

// ─── Helper: parse @mentions from message content ─────────────────────────────

function parseMentionedUsernames(content) {
  if (!content || typeof content !== 'string') return [];
  const matches = content.match(/@([a-zA-Z0-9_\.]{2,30})/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

/**
 * Notify chat members who were @mentioned in a message.
 * Skips the sender. Does not duplicate with notifyOfflineMembers — MENTION
 * notifications are created regardless of whether the user is in the room,
 * so they always get alerted about a direct mention.
 */
async function notifyMentions(io, chat, message, senderUser) {
  const mentionedUsernames = parseMentionedUsernames(message.content);
  if (mentionedUsernames.length === 0) return;

  const senderId   = senderUser._id.toString();
  const chatId     = chat._id.toString();
  const senderName = senderUser.displayName || senderUser.username;
  const preview    =
    message.content?.length > 100
      ? message.content.slice(0, 100) + '…'
      : message.content;

  // Populate member users to resolve @username → userId
  const populatedChat = await Chat.findById(chat._id)
    .populate('members.user', '_id username displayName')
    .lean();
  if (!populatedChat) return;

  const mentionedMembers = populatedChat.members.filter((m) => {
    if (!m.user || m.user._id.toString() === senderId) return false;
    return mentionedUsernames.includes(m.user.username.toLowerCase());
  });

  await Promise.all(
    mentionedMembers.map(async ({ user: mentionedUser }) => {
      try {
        const notification = await createNotification({
          recipient: mentionedUser._id,
          sender:    senderId,
          type:      NOTIFICATION_TYPES.MENTION,
          title:     `${senderName} mentioned you`,
          body:      preview,
          data:      { chatId, messageId: message._id.toString() },
        });
        deliverNotification(io, mentionedUser._id.toString(), toNotificationDTO(notification));
      } catch (err) {
        logger.warn('[Chat] mention notification failed', { err: err.message });
      }
    })
  );
}

// ─── Handler registration ─────────────────────────────────────────────────────

function registerChatHandler(io, socket) {
  const userId = socket.user._id.toString();
  const typingTimers = new Map();

  function clearTypingTimer(chatId) {
    const key = `${userId}:${chatId}`;
    if (typingTimers.has(key)) {
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
    }
  }

  function setTypingTimer(chatId) {
    clearTypingTimer(chatId);
    const key   = `${userId}:${chatId}`;
    const timer = setTimeout(() => {
      typingTimers.delete(key);
      socket.to(chatId).emit(CHAT_EVENTS.TYPING_STOP, { chatId, userId });
    }, TYPING_TIMEOUT_MS);
    typingTimers.set(key, timer);
  }

  // ── Join a chat room ─────────────────────────────────────────────────────

  socket.on(CHAT_EVENTS.JOIN_ROOM, async ({ chatId }, callback) => {
    try {
      const isMember = await chatRepository.isMember(chatId, userId);
      if (!isMember) return callback?.({ error: 'NOT_CHAT_MEMBER' });
      socket.join(chatId);
      callback?.({ success: true });
      logger.debug(`[Chat] ${socket.user.username} joined room ${chatId}`);
    } catch (err) {
      logger.error('[Chat] join_room error', { err: err.message });
      callback?.({ error: 'JOIN_FAILED' });
    }
  });

  // ── Leave a chat room ────────────────────────────────────────────────────

  socket.on(CHAT_EVENTS.LEAVE_ROOM, ({ chatId }) => {
    socket.leave(chatId);
    clearTypingTimer(chatId);
    socket.to(chatId).emit(CHAT_EVENTS.TYPING_STOP, { chatId, userId });
  });

  // ── Send a text message ──────────────────────────────────────────────────

  socket.on(CHAT_EVENTS.NEW_MESSAGE, async ({ chatId, content, replyTo }, callback) => {
    try {
      const chat = await chatRepository.findById(chatId);
      if (!chat) return callback?.({ error: 'CHAT_NOT_FOUND' });

      const isMember = chat.members.some((m) => m.user.toString() === userId);
      if (!isMember) return callback?.({ error: 'NOT_CHAT_MEMBER' });

      clearTypingTimer(chatId);

      const message = await messageRepository.create({
        chat:    chatId,
        sender:  userId,
        type:    MESSAGE_TYPES.TEXT,
        content: content?.trim(),
        replyTo: replyTo || null,
      });

      await Promise.all([
        chatRepository.setLastMessage(chatId, message._id),
        chatRepository.incrementUnreadCount(chatId, userId),
      ]);

      const payload = buildMessagePayload(message, socket.user);

      io.to(chatId).emit(CHAT_EVENTS.MESSAGE_SENT, { message: payload });
      callback?.({ success: true, message: payload });

      // Push lastMessage update to members NOT in the room so their sidebar
      // reorders and shows the preview even though they missed MESSAGE_SENT.
      // This is synchronous (no DB calls) — run inline, no try/catch needed.
      pushChatUpdated(io, chat, message, socket.user);

      notifyOfflineMembers(io, chat, message, socket.user).catch((err) =>
        logger.error('[Chat] notifyOfflineMembers failed', { err: err.message })
      );
      notifyMentions(io, chat, message, socket.user).catch((err) =>
        logger.error('[Chat] notifyMentions failed', { err: err.message })
      );
    } catch (err) {
      logger.error('[Chat] new_message error', { err: err.message });
      callback?.({ error: 'SEND_FAILED' });
    }
  });

  // ── Delivery acknowledgment (direct chats only) ───────────────────────────

  socket.on(CHAT_EVENTS.MESSAGE_DELIVERED, async ({ chatId, messageIds }) => {
    try {
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;
      const chat = await chatRepository.findById(chatId);
      if (!chat || chat.type !== CHAT_TYPES.DIRECT) return;
      await messageRepository.bulkUpdateStatus(messageIds, 'delivered');
      socket.to(chatId).emit(CHAT_EVENTS.MESSAGE_DELIVERED, { chatId, messageIds, deliveredBy: userId });
    } catch (err) {
      logger.error('[Chat] message_delivered error', { err: err.message });
    }
  });

  // ── Mark messages as read ────────────────────────────────────────────────

  socket.on(CHAT_EVENTS.MESSAGE_READ, async ({ chatId, messageIds }) => {
    try {
      const hasSpecificIds = Array.isArray(messageIds) && messageIds.length > 0;
      await Promise.all([
        hasSpecificIds
          ? messageRepository.bulkUpdateStatus(messageIds, 'read')
          // Empty messageIds = user opened the chat — mark ALL unread messages as read
          : messageRepository.markAllReadInChat(chatId, userId),
        chatRepository.updateLastRead(chatId, userId),
        chatRepository.resetUnreadCount(chatId, userId),
      ]);
      // allRead:true tells the frontend to mark ALL messages in the chat as read
      // (used when messageIds is empty — user opened the chat).
      socket.to(chatId).emit(CHAT_EVENTS.MESSAGE_READ, {
        chatId,
        userId,
        messageIds,
        allRead: !hasSpecificIds,
      });
      io.to(`user:${userId}`).emit(CHAT_EVENTS.UNREAD_UPDATED, { chatId, unreadCount: 0 });
    } catch (err) {
      logger.error('[Chat] message_read error', { err: err.message });
    }
  });

  // ── Typing indicators ────────────────────────────────────────────────────

  socket.on(CHAT_EVENTS.TYPING_START, ({ chatId }) => {
    socket.to(chatId).emit(CHAT_EVENTS.TYPING_START, {
      chatId,
      userId,
      username:    socket.user.username,
      displayName: socket.user.displayName || socket.user.username,
    });
    setTypingTimer(chatId);
  });

  socket.on(CHAT_EVENTS.TYPING_STOP, ({ chatId }) => {
    clearTypingTimer(chatId);
    socket.to(chatId).emit(CHAT_EVENTS.TYPING_STOP, { chatId, userId });
  });

  // ── Disconnect cleanup ───────────────────────────────────────────────────

  socket.on('disconnect', () => {
    for (const [, timer] of typingTimers) clearTimeout(timer);
    typingTimers.clear();
  });
}

module.exports = { registerChatHandler };
