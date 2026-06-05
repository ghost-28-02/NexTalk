import { createSlice } from '@reduxjs/toolkit';

/**
 * chatSlice — single source of truth for all runtime chat state.
 *
 * Why NOT RTK Query cache for messages?
 *   RTK Query is built for request/response caching. Chat messages are a
 *   realtime-append stream — every socket event requires mutating the list.
 *   Using RTK Query's updateQueryData for every socket event is verbose and
 *   error-prone. chatSlice owns the messages and is updated directly by
 *   useChatSocket, keeping the socket→state flow in one predictable place.
 *
 * State shape:
 *   chats[]               — sidebar list, sorted (pinned first, then by lastMessage time)
 *   activeChatId          — currently open conversation
 *   messages[chatId]      — per-chat message state (items, hasMore, nextCursor, isLoading)
 *   typing[chatId]        — { [userId]: displayName } — truthy = typing
 *   optimistic[tempId]    — { chatId } — pending messages awaiting server confirmation
 */

// ─── Sort helper ──────────────────────────────────────────────────────────────

function sortChats(chats) {
  return [...chats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const aTime = new Date(a.lastMessage?.createdAt || a.updatedAt || 0).getTime();
    const bTime = new Date(b.lastMessage?.createdAt || b.updatedAt || 0).getTime();
    return bTime - aTime;
  });
}

function emptyMessageState() {
  return { items: [], hasMore: false, nextCursor: null, isLoading: false };
}

// ─── Slice ────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    chats:       [],    // Chat[]
    chatsLoaded: false,
    activeChatId: null, // string | null

    messages:   {},     // { [chatId]: { items, hasMore, nextCursor, isLoading } }
    typing:     {},     // { [chatId]: { [userId]: displayName } }
    optimistic: {},     // { [tempId]: { chatId } }
  },

  reducers: {
    // ── Chat list ─────────────────────────────────────────────────────────────

    /** Called once after GET /chats completes. Seeds the sorted sidebar list. */
    chatsLoaded(state, { payload: chats }) {
      state.chats       = sortChats(chats);
      state.chatsLoaded = true;
    },

    /** Prepend a newly created chat (getOrCreateDirect / createGroup). */
    chatAdded(state, { payload: chat }) {
      // Remove duplicates (in case getOrCreateDirect returns an existing chat)
      state.chats = sortChats([
        chat,
        ...state.chats.filter((c) => c.id.toString() !== chat.id.toString()),
      ]);
    },

    /** Partial update — e.g., group renamed or avatar changed. */
    chatMetaUpdated(state, { payload: { chatId, changes } }) {
      const idx = state.chats.findIndex((c) => c.id.toString() === chatId.toString());
      if (idx !== -1) {
        state.chats[idx] = { ...state.chats[idx], ...changes };
        state.chats = sortChats(state.chats);
      }
    },

    /** Remove a chat from the sidebar (leave group / delete). */
    chatRemoved(state, { payload: chatId }) {
      state.chats = state.chats.filter((c) => c.id.toString() !== chatId.toString());
      if (state.activeChatId?.toString() === chatId.toString()) {
        state.activeChatId = null;
      }
      delete state.messages[chatId];
    },

    chatPinToggled(state, { payload: { chatId, isPinned } }) {
      const chat = state.chats.find((c) => c.id?.toString() === chatId?.toString());
      if (chat) {
        chat.isPinned = isPinned;
        state.chats = sortChats(state.chats);
      }
    },

    chatMuteToggled(state, { payload: { chatId, isMuted } }) {
      const chat = state.chats.find((c) => c.id?.toString() === chatId?.toString());
      if (chat) chat.isMuted = isMuted;
    },

    /** Set the currently open conversation. */
    activeChatSet(state, { payload: chatId }) {
      state.activeChatId = chatId;
    },

    // ── Unread counts ─────────────────────────────────────────────────────────

    /** Reset unread badge for a chat (user opened it). */
    markChatRead(state, { payload: chatId }) {
      const chat = state.chats.find((c) => c.id.toString() === chatId.toString());
      if (chat) chat.unreadCount = 0;
    },

    /**
     * Cross-device unread sync.
     * Server pushes chat:unread_updated to user:{userId} room when another
     * device marks the chat as read.
     */
    unreadSynced(state, { payload: { chatId, unreadCount } }) {
      const chat = state.chats.find((c) => c.id.toString() === chatId.toString());
      if (chat) chat.unreadCount = unreadCount;
    },

    // ── Messages ──────────────────────────────────────────────────────────────

    /** Initial load for a chat (first open or after a reconnect). */
    messagesLoaded(state, { payload: { chatId, messages, hasMore, nextCursor } }) {
      state.messages[chatId] = {
        items:      messages,
        hasMore:    hasMore  ?? false,
        nextCursor: nextCursor ?? null,
        isLoading:  false,
      };
    },

    /** Prepend older messages fetched via infinite scroll (scroll-up). */
    olderMessagesLoaded(state, { payload: { chatId, messages, hasMore, nextCursor } }) {
      if (!state.messages[chatId]) {
        state.messages[chatId] = emptyMessageState();
      }
      state.messages[chatId].items      = [...messages, ...state.messages[chatId].items];
      state.messages[chatId].hasMore    = hasMore  ?? false;
      state.messages[chatId].nextCursor = nextCursor ?? null;
      state.messages[chatId].isLoading  = false;
    },

    messagesLoadingStart(state, { payload: chatId }) {
      if (!state.messages[chatId]) state.messages[chatId] = emptyMessageState();
      state.messages[chatId].isLoading = true;
    },

    /**
     * New message arrived via socket (chat:message_sent).
     * - Appends to the message list if it's loaded.
     * - Updates lastMessage preview on the chat entry.
     * - Increments unreadCount if this isn't the active chat.
     * - Re-sorts the sidebar.
     */
    messageReceived(state, { payload: message }) {
      const chatId = message.chat?.toString();
      if (!chatId) return;

      // Append to message list (dedup by id — socket may relay to sender too)
      if (state.messages[chatId]) {
        const exists = state.messages[chatId].items.some(
          (m) => m.id?.toString() === message.id?.toString()
        );
        if (!exists) state.messages[chatId].items.push(message);
      }

      // Update sidebar entry
      const chatIdx = state.chats.findIndex((c) => c.id?.toString() === chatId);
      if (chatIdx !== -1) {
        state.chats[chatIdx].lastMessage = {
          id:        message.id,
          senderId:  message.senderId,
          content:   message.content,
          type:      message.type,
          status:    message.status,
          createdAt: message.createdAt,
        };

        // Increment unread only for non-active chats
        if (chatId !== state.activeChatId) {
          state.chats[chatIdx].unreadCount = (state.chats[chatIdx].unreadCount || 0) + 1;
        }

        state.chats = sortChats(state.chats);
      }
    },

    /** Optimistic add — message shows immediately with status 'sending'. */
    optimisticMessageAdded(state, { payload: { tempId, chatId, content, sender } }) {
      if (!state.messages[chatId]) state.messages[chatId] = emptyMessageState();

      state.messages[chatId].items.push({
        id:          tempId,
        chat:        chatId,
        senderId:    sender.id,
        sender,
        content,
        type:        'text',
        status:      'sending',
        reactions:   [],
        isDeleted:   false,
        _isOptimistic: true,
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      });

      state.optimistic[tempId] = { chatId };
    },

    /**
     * Server confirmed the message — replace optimistic entry with real data.
     * The real message object comes from the socket callback payload.
     *
     * Race-condition guard:
     *   The server broadcasts MESSAGE_SENT to the room (including the sender's
     *   own socket) BEFORE the ack callback fires. This means `messageReceived`
     *   may have already appended the real message to the list while the
     *   optimistic placeholder (tempId) was still present — resulting in a
     *   duplicate once we replace the placeholder here.
     *
     *   Fix: after replacing the temp entry, filter out any other item that
     *   carries the same real message id (the duplicate appended by
     *   messageReceived). The replace-then-filter approach keeps array order
     *   stable (the confirmed message stays in its original position).
     */
    optimisticMessageConfirmed(state, { payload: { tempId, message } }) {
      const chatId = state.optimistic[tempId]?.chatId;
      if (!chatId || !state.messages[chatId]) return;

      const realId = message.id?.toString();
      const items  = state.messages[chatId].items;

      const tempIdx = items.findIndex((m) => m.id === tempId);
      if (tempIdx !== -1) {
        // 1. Replace temp entry with confirmed message
        items[tempIdx] = { ...message, _isOptimistic: false };

        // 2. Remove any duplicate real message that messageReceived may have
        //    appended before this ack arrived (broadcast beats ack race).
        state.messages[chatId].items = items.filter(
          (m, i) => i === tempIdx || m.id?.toString() !== realId,
        );
      }

      delete state.optimistic[tempId];

      // Update sidebar lastMessage
      const chatIdx = state.chats.findIndex((c) => c.id?.toString() === chatId);
      if (chatIdx !== -1) {
        state.chats[chatIdx].lastMessage = {
          id:        message.id,
          senderId:  message.senderId,
          content:   message.content,
          type:      message.type,
          status:    message.status,
          createdAt: message.createdAt,
        };
        state.chats = sortChats(state.chats);
      }
    },

    /** Send failed — mark the optimistic entry as 'failed' for retry UI. */
    optimisticMessageFailed(state, { payload: tempId }) {
      const chatId = state.optimistic[tempId]?.chatId;
      if (!chatId || !state.messages[chatId]) return;
      const idx = state.messages[chatId].items.findIndex((m) => m.id === tempId);
      if (idx !== -1) state.messages[chatId].items[idx].status = 'failed';
      // Keep in optimistic map so the retry button can re-use the tempId
    },

    /** Retry a failed optimistic message — reset status back to 'sending'. */
    optimisticMessageRetry(state, { payload: tempId }) {
      const chatId = state.optimistic[tempId]?.chatId;
      if (!chatId || !state.messages[chatId]) return;
      const idx = state.messages[chatId].items.findIndex((m) => m.id === tempId);
      if (idx !== -1) state.messages[chatId].items[idx].status = 'sending';
    },

    /** Update delivery status for a set of message IDs (delivered / read). */
    messagesStatusUpdated(state, { payload: { chatId, messageIds, status, allRead } }) {
      if (!state.messages[chatId]) return;
      if (allRead) {
        // Mark every message in this chat as read (user opened the chat)
        state.messages[chatId].items = state.messages[chatId].items.map((m) =>
          ({ ...m, status: 'read' })
        );
      } else {
        const idSet = new Set((messageIds ?? []).map(String));
        state.messages[chatId].items = state.messages[chatId].items.map((m) =>
          idSet.has(m.id?.toString()) ? { ...m, status } : m
        );
      }
    },

    /** Replace an edited message in-place. */
    messageEdited(state, { payload: { chatId, message } }) {
      if (!state.messages[chatId]) return;
      const idx = state.messages[chatId].items.findIndex(
        (m) => m.id?.toString() === message.id?.toString()
      );
      if (idx !== -1) state.messages[chatId].items[idx] = message;
    },

    /** Soft-delete: replace content with null / set isDeleted flag. */
    messageDeleted(state, { payload: { chatId, messageId } }) {
      if (!state.messages[chatId]) return;
      const idx = state.messages[chatId].items.findIndex(
        (m) => m.id?.toString() === messageId.toString()
      );
      if (idx !== -1) {
        state.messages[chatId].items[idx] = {
          ...state.messages[chatId].items[idx],
          content:   null,
          isDeleted: true,
        };
      }
    },

    /**
     * Bump unread badge for a chat that isn't the active room.
     * Called by useNotificationSocket when a notification:new arrives with
     * type=message, so the sidebar badge updates even for chats the user
     * hasn't joined via the socket room.
     */
    chatUnreadIncremented(state, { payload: chatId }) {
      if (chatId?.toString() === state.activeChatId?.toString()) return;
      const chat = state.chats.find((c) => c.id?.toString() === chatId?.toString());
      if (chat) chat.unreadCount = (chat.unreadCount || 0) + 1;
    },

    /**
     * chat:chat_updated — server pushes this to `user:{id}` personal rooms
     * for members who are online but NOT in the chat room (viewing a different
     * chat or on a different page).
     *
     * Updates lastMessage preview and re-sorts the sidebar so the conversation
     * bubbles to the top — exactly like WhatsApp behaviour.
     *
     * Does NOT touch unreadCount — notification:new (chatUnreadIncremented)
     * is the single owner of the badge so there is no double-counting.
     */
    chatUpdatedFromBackground(state, { payload: { chatId, lastMessage } }) {
      const idx = state.chats.findIndex((c) => c.id?.toString() === chatId?.toString());
      if (idx === -1) return;
      state.chats[idx].lastMessage = lastMessage;
      state.chats = sortChats(state.chats);
    },

    // ── Typing indicators ─────────────────────────────────────────────────────

    typingStarted(state, { payload: { chatId, userId, displayName } }) {
      if (!state.typing[chatId]) state.typing[chatId] = {};
      state.typing[chatId][userId] = displayName;
    },

    typingStopped(state, { payload: { chatId, userId } }) {
      if (state.typing[chatId]) {
        delete state.typing[chatId][userId];
      }
    },

    /**
     * Realtime profile sync — server pushes user:profile_updated when a
     * participant changes their displayName, avatar, or username.
     *
     * Updates every place in the chat state that caches this user's display info:
     *   1. message.sender         — visible in message bubbles and headers
     *   2. chat.participants[]    — sidebar avatar / name in group chats
     *   3. chat.name / avatar     — DM sidebar entry (derived from the other user)
     *
     * Payload fields (all optional — only changed fields are included):
     *   userId       — the user who changed (string)
     *   displayName  — new display name
     *   avatarUrl    — new avatar URL string (not the full avatar object)
     *   username     — new username
     *   currentUserId — the logged-in user's id; own profile is skipped here
     *                   (authSlice.updateUser owns own-profile state)
     */
    participantProfileUpdated(state, { payload }) {
      const { userId, displayName, avatarUrl, username, currentUserId } = payload;
      if (!userId) return;

      // Skip own profile — authSlice.updateUser() owns the current user's state.
      if (userId === currentUserId?.toString()) return;

      const userIdStr = userId.toString();

      // 1. Update sender display info in every cached message list
      for (const chatId of Object.keys(state.messages)) {
        if (!state.messages[chatId]?.items) continue;
        state.messages[chatId].items = state.messages[chatId].items.map((msg) => {
          if (msg.senderId?.toString() !== userIdStr) return msg;
          return {
            ...msg,
            sender: {
              ...msg.sender,
              ...(displayName !== undefined && { displayName, name: displayName }),
              ...(avatarUrl   !== undefined && { avatar: avatarUrl }),
              ...(username    !== undefined && { username }),
            },
          };
        });
      }

      // 2. Update participants array in every chat that includes this user,
      //    and for DMs also update the chat-level name / avatar
      state.chats = state.chats.map((chat) => {
        const hasParticipant = (chat.participants ?? []).some(
          (p) => (p.id ?? p._id)?.toString() === userIdStr
        );

        // For non-DMs, skip chats where the user isn't a participant
        if (!hasParticipant && chat.type !== 'direct') return chat;
        if (!hasParticipant) return chat;

        const updatedParticipants = (chat.participants ?? []).map((p) => {
          if ((p.id ?? p._id)?.toString() !== userIdStr) return p;
          return {
            ...p,
            ...(displayName !== undefined && { displayName, name: displayName }),
            ...(avatarUrl   !== undefined && { avatar: avatarUrl }),
            ...(username    !== undefined && { username }),
          };
        });

        // For DMs the sidebar entry IS the other user — sync chat.name / chat.avatar
        const chatUpdates = { participants: updatedParticipants };
        if (chat.type === 'direct') {
          if (displayName !== undefined) chatUpdates.name   = displayName;
          if (avatarUrl   !== undefined) chatUpdates.avatar = avatarUrl;
        }

        return { ...chat, ...chatUpdates };
      });
    },

    // ── Reset ─────────────────────────────────────────────────────────────────

    chatStateReset() {
      return {
        chats: [], chatsLoaded: false, activeChatId: null,
        messages: {}, typing: {}, optimistic: {},
      };
    },
  },
});

export const {
  chatsLoaded,
  chatAdded,
  chatMetaUpdated,
  chatRemoved,
  chatPinToggled,
  chatMuteToggled,
  activeChatSet,
  markChatRead,
  unreadSynced,
  chatUnreadIncremented,
  chatUpdatedFromBackground,
  participantProfileUpdated,
  messagesLoaded,
  olderMessagesLoaded,
  messagesLoadingStart,
  messageReceived,
  optimisticMessageAdded,
  optimisticMessageConfirmed,
  optimisticMessageFailed,
  optimisticMessageRetry,
  messagesStatusUpdated,
  messageEdited,
  messageDeleted,
  typingStarted,
  typingStopped,
  chatStateReset,
} = chatSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectChats        = (s) => s.chat.chats;
export const selectChatsLoaded  = (s) => s.chat.chatsLoaded;
export const selectActiveChatId = (s) => s.chat.activeChatId;
export const selectActiveChat   = (s) =>
  s.chat.chats.find((c) => c.id?.toString() === s.chat.activeChatId);

export const selectChatMessages = (chatId) => (s) =>
  s.chat.messages[chatId]?.items ?? [];
export const selectHasMoreMessages = (chatId) => (s) =>
  s.chat.messages[chatId]?.hasMore ?? false;
export const selectNextCursor = (chatId) => (s) =>
  s.chat.messages[chatId]?.nextCursor ?? null;
export const selectMessagesLoading = (chatId) => (s) =>
  s.chat.messages[chatId]?.isLoading ?? false;

/** Returns an array of { userId, displayName } for the typing indicator. */
export const selectTypingUsers = (chatId) => (s) =>
  Object.entries(s.chat.typing[chatId] ?? {}).map(([userId, displayName]) => ({
    userId,
    displayName,
  }));

export const selectTotalUnread = (s) =>
  s.chat.chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

export default chatSlice.reducer;
