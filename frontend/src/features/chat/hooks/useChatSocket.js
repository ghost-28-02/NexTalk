'use client';

/**
 * useChatSocket — bridges Socket.IO events into chatSlice Redux state.
 *
 * Responsibilities:
 *   - Join / leave `chat:{chatId}` room when activeChatId changes
 *   - Dispatch Redux actions for every inbound socket event
 *   - Auto-emit delivered / read receipts when appropriate
 *
 * Design decisions:
 *   - Event listeners are registered once (socket dependency only).
 *     activeChatId and currentUser are accessed via refs so listeners
 *     never need to be re-registered when those values change.
 *   - Room join/leave runs in a separate effect keyed on activeChatId.
 *   - markRead (HTTP fallback) is called when a new message arrives in
 *     the currently active chat — the socket path (MESSAGE_READ emit)
 *     handles the realtime side; the HTTP call persists lastReadAt in DB.
 */

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSocket } from '@/features/socket';
import { CHAT_EVENTS, USER_EVENTS } from '@/features/socket/constants/socketEvents';
import { updateUser } from '@/features/auth/store/authSlice';
import { useMarkReadMutation, useGetMyChatsQuery } from '../services/chatApi';
import {
  messageReceived,
  typingStarted,
  typingStopped,
  messagesStatusUpdated,
  messageEdited,
  messageDeleted,
  unreadSynced,
  chatUpdatedFromBackground,
  chatAdded,
  participantProfileUpdated,
  selectActiveChatId,
} from '../store/chatSlice';

export function useChatSocket() {
  const dispatch      = useDispatch();
  const socket        = useSocket();
  const activeChatId  = useSelector(selectActiveChatId);
  const currentUser   = useSelector((s) => s.auth.user);
  const [markRead]    = useMarkReadMutation();

  // On socket reconnect, re-fetch the chat list so unread counts that
  // accumulated while the connection was down are pulled from the DB.
  const { refetch: refetchChats } = useGetMyChatsQuery();

  // Refs keep closures inside event handlers always fresh without
  // requiring listener teardown/re-registration on every render.
  const activeChatIdRef = useRef(activeChatId);
  const currentUserRef  = useRef(currentUser);

  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { currentUserRef.current  = currentUser;  }, [currentUser]);

  // ── Room join / leave ────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket?.connected || !activeChatId) return;

    socket.emit(CHAT_EVENTS.JOIN_ROOM, { chatId: activeChatId });

    return () => {
      socket.emit(CHAT_EVENTS.LEAVE_ROOM, { chatId: activeChatId });
    };
  }, [socket, activeChatId]);

  // ── Event listeners (registered once per socket instance) ────────────────
  useEffect(() => {
    if (!socket) return;

    // ── chat:message_sent ─────────────────────────────────────────────────
    // Backend emits: { message: payload }  (not the payload directly)
    const onMessageSent = ({ message }) => {
      if (!message) return;
      const chatId = message.chat?.toString();
      const myId   = currentUserRef.current?.id?.toString();

      dispatch(messageReceived(message));

      // Message from someone else arriving in our active chat → mark read
      if (chatId === activeChatIdRef.current && message.senderId?.toString() !== myId) {
        // HTTP path persists lastReadAt; socket path propagates read status to sender
        markRead(chatId).catch(() => {});
        socket.emit(CHAT_EVENTS.MESSAGE_READ, { chatId, messageIds: [message.id] });
        return;
      }

      // Message in a background chat → deliver ack (server filters for DMs only)
      if (chatId !== activeChatIdRef.current && message.senderId?.toString() !== myId) {
        socket.emit(CHAT_EVENTS.MESSAGE_DELIVERED, { chatId, messageIds: [message.id] });
      }
    };

    // ── chat:typing_start / stop ──────────────────────────────────────────
    const onTypingStart = ({ chatId, userId, displayName }) => {
      // Suppress our own typing echo (server shouldn't send it back, but guard anyway)
      if (userId?.toString() === currentUserRef.current?.id?.toString()) return;
      dispatch(typingStarted({ chatId, userId, displayName }));
    };

    const onTypingStop = ({ chatId, userId }) => {
      dispatch(typingStopped({ chatId, userId }));
    };

    // ── Delivery / read receipts ──────────────────────────────────────────
    const onMessageDelivered = ({ chatId, messageIds }) => {
      dispatch(messagesStatusUpdated({ chatId, messageIds, status: 'delivered' }));
    };

    const onMessageRead = ({ chatId, messageIds }) => {
      dispatch(messagesStatusUpdated({ chatId, messageIds, status: 'read' }));
    };

    // ── Edit / delete ─────────────────────────────────────────────────────
    const onMessageEdited = ({ chatId, message }) => {
      dispatch(messageEdited({ chatId, message }));
    };

    const onMessageDeleted = ({ chatId, messageId }) => {
      dispatch(messageDeleted({ chatId, messageId }));
    };

    // ── Cross-device unread sync ──────────────────────────────────────────
    // Server emits this to `user:{id}` after HTTP markRead so every other
    // device the user has open immediately clears that chat's badge.
    const onUnreadUpdated = ({ chatId, unreadCount }) => {
      dispatch(unreadSynced({ chatId, unreadCount }));
    };

    // ── Background chat update (WhatsApp-style sidebar reorder) ───────────
    // Server emits chat:chat_updated to `user:{id}` for members NOT in the
    // room. Carries the new lastMessage so the preview updates and sortChats
    // moves this conversation to the top — even though the user never
    // received MESSAGE_SENT (they weren't subscribed to that room).
    const onChatUpdated = ({ chatId, lastMessage }) => {
      dispatch(chatUpdatedFromBackground({ chatId, lastMessage }));
    };

    // ── New conversation created by the other user ────────────────────────
    // Server emits chat:new_chat to `user:{id}` when another user opens a
    // direct chat with us for the first time. Payload is the full Chat DTO
    // shaped from our perspective. chatAdded deduplicates by id, so this
    // is safe even if we somehow already have the chat in state.
    const onNewChat = ({ chat }) => {
      if (!chat) return;
      dispatch(chatAdded(chat));
    };

    // ── Reconnect — resync stale unread counts from the server ────────────
    // If the user's socket dropped and messages arrived while it was down,
    // the in-memory unread counts are stale. Re-fetching the chat list
    // pulls the DB-persisted counts so every badge is correct again.
    const onReconnect = () => {
      refetchChats();
    };

    // ── Realtime profile sync ─────────────────────────────────────────────
    // Server emits user:profile_updated to:
    //   a) user:{userId} personal room — own profile changes on other devices
    //   b) chat:{chatId} rooms — participant name/avatar changes for everyone
    //
    // If the payload's userId matches the current user → update authSlice.user
    // (cross-device own-profile sync: name, avatar, bio all stay in sync).
    // Otherwise → update participant display data in chatSlice.
    const onProfileUpdated = (data) => {
      const myId = currentUserRef.current?.id?.toString();
      if (!data?.userId) return;

      if (data.userId === myId) {
        // Own profile changed on another device — merge into authSlice
        const patch = {};
        if (data.displayName !== undefined) patch.displayName = data.displayName;
        if (data.avatarUrl   !== undefined) patch.avatar      = data.avatarUrl;
        if (data.username    !== undefined) patch.username    = data.username;
        if (data.bio         !== undefined) patch.bio         = data.bio;
        if (Object.keys(patch).length > 0) dispatch(updateUser(patch));
      } else {
        // Another user's profile changed — update participant display in chats
        dispatch(participantProfileUpdated({ ...data, currentUserId: myId }));
      }
    };

    socket.on(CHAT_EVENTS.MESSAGE_SENT,      onMessageSent);
    socket.on(CHAT_EVENTS.TYPING_START,      onTypingStart);
    socket.on(CHAT_EVENTS.TYPING_STOP,       onTypingStop);
    socket.on(CHAT_EVENTS.MESSAGE_DELIVERED, onMessageDelivered);
    socket.on(CHAT_EVENTS.MESSAGE_READ,      onMessageRead);
    socket.on(CHAT_EVENTS.MESSAGE_EDITED,    onMessageEdited);
    socket.on(CHAT_EVENTS.MESSAGE_DELETED,   onMessageDeleted);
    socket.on(CHAT_EVENTS.UNREAD_UPDATED,    onUnreadUpdated);
    socket.on(CHAT_EVENTS.CHAT_UPDATED,      onChatUpdated);
    socket.on(CHAT_EVENTS.NEW_CHAT,          onNewChat);
    socket.on(USER_EVENTS.PROFILE_UPDATED,   onProfileUpdated);
    socket.on('connect',                     onReconnect);

    return () => {
      socket.off(CHAT_EVENTS.MESSAGE_SENT,      onMessageSent);
      socket.off(CHAT_EVENTS.TYPING_START,      onTypingStart);
      socket.off(CHAT_EVENTS.TYPING_STOP,       onTypingStop);
      socket.off(CHAT_EVENTS.MESSAGE_DELIVERED, onMessageDelivered);
      socket.off(CHAT_EVENTS.MESSAGE_READ,      onMessageRead);
      socket.off(CHAT_EVENTS.MESSAGE_EDITED,    onMessageEdited);
      socket.off(CHAT_EVENTS.MESSAGE_DELETED,   onMessageDeleted);
      socket.off(CHAT_EVENTS.UNREAD_UPDATED,    onUnreadUpdated);
      socket.off(CHAT_EVENTS.CHAT_UPDATED,      onChatUpdated);
      socket.off(CHAT_EVENTS.NEW_CHAT,          onNewChat);
      socket.off(USER_EVENTS.PROFILE_UPDATED,   onProfileUpdated);
      socket.off('connect',                     onReconnect);
    };
  }, [socket, dispatch, markRead, refetchChats]);
}
