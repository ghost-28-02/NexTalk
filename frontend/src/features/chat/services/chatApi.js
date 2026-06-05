import { baseApi } from '@/services/baseApi';
import {
  chatsLoaded,
  chatAdded,
  messagesLoaded,
  olderMessagesLoaded,
  messagesLoadingStart,
} from '../store/chatSlice';

/**
 * chatApi — RTK Query endpoints for all chat and message HTTP calls.
 *
 * Design notes:
 *   - All endpoints inject into the shared baseApi (single reducer, shared reauth).
 *   - `getMyChats` and `getMessages` use onQueryStarted to seed chatSlice so the
 *     rest of the UI reads from Redux, not from RTK Query cache.
 *   - Socket events are NOT handled here — useChatSocket bridges socket → chatSlice.
 *   - Message mutations (send, edit, delete) don't need invalidation because
 *     the socket broadcast updates chatSlice for all clients in the room.
 */
export const chatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ── Chat list ─────────────────────────────────────────────────────────────

    getMyChats: builder.query({
      query: ()  => '/chats',
      providesTags: ['Chat'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // data.data is the flat array from ApiResponse.paginated
          dispatch(chatsLoaded(data.data ?? []));
        } catch {
          // Error displayed by the component
        }
      },
    }),

    /**
     * Get or create a direct conversation with another user.
     * Returns the chat object and seeds it into the sidebar.
     */
    getOrCreateDirect: builder.mutation({
      query: (userId) => ({
        url:    '/chats/direct',
        method: 'POST',
        body:   { userId },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(chatAdded(data.data));
        } catch {}
      },
    }),

    createGroup: builder.mutation({
      query: (body) => ({ url: '/chats/group', method: 'POST', body }),
      invalidatesTags: ['Chat'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(chatAdded(data.data));
        } catch {}
      },
    }),

    /** HTTP fallback for mark-as-read (socket path is preferred; this covers the REST path). */
    markRead: builder.mutation({
      query: (chatId) => ({ url: `/chats/${chatId}/read`, method: 'PATCH' }),
    }),

    leaveChat: builder.mutation({
      query: (chatId) => ({ url: `/chats/${chatId}/leave`, method: 'DELETE' }),
      invalidatesTags: ['Chat'],
    }),

    togglePin: builder.mutation({
      query: (chatId) => ({ url: `/chats/${chatId}/pin`, method: 'PATCH' }),
    }),

    toggleMute: builder.mutation({
      query: (chatId) => ({ url: `/chats/${chatId}/mute`, method: 'PATCH' }),
    }),

    deleteChat: builder.mutation({
      query: (chatId) => ({ url: `/chats/${chatId}`, method: 'DELETE' }),
      invalidatesTags: ['Chat'],
    }),

    // ── Messages ──────────────────────────────────────────────────────────────

    /**
     * Cursor-based message fetch.
     *   Initial:    { chatId }                 → 50 newest messages
     *   Load older: { chatId, before: cursorId } → 50 messages before the cursor
     *
     * onQueryStarted seeds chatSlice so the component reads from Redux.
     */
    getMessages: builder.query({
      query: ({ chatId, before, limit = 50 }) => ({
        url:    `/chats/${chatId}/messages`,
        params: { ...(before ? { before } : {}), limit },
      }),
      providesTags: (r, e, { chatId }) => [{ type: 'Message', id: chatId }],
      async onQueryStarted({ chatId, before }, { dispatch, queryFulfilled }) {
        dispatch(messagesLoadingStart(chatId));
        try {
          const { data } = await queryFulfilled;
          const payload = { chatId, ...data.data }; // { messages, hasMore, nextCursor }
          if (before) {
            dispatch(olderMessagesLoaded(payload));
          } else {
            dispatch(messagesLoaded(payload));
          }
        } catch {
          // isLoading reset on next successful load
        }
      },
    }),

    /** HTTP send — used as fallback when socket send fails. */
    sendMessage: builder.mutation({
      query: ({ chatId, content, replyTo }) => ({
        url:    `/chats/${chatId}/messages`,
        method: 'POST',
        body:   { content, replyTo },
      }),
    }),

    /** Upload image, video, or file as a message. Body must be FormData with key 'file'. */
    sendMediaMessage: builder.mutation({
      query: ({ chatId, formData }) => ({
        url:      `/chats/${chatId}/messages/media`,
        method:   'POST',
        body:     formData,
        formData: true,
      }),
    }),

    editMessage: builder.mutation({
      query: ({ chatId, messageId, content }) => ({
        url:    `/chats/${chatId}/messages/${messageId}`,
        method: 'PATCH',
        body:   { content },
      }),
    }),

    deleteMessage: builder.mutation({
      query: ({ chatId, messageId }) => ({
        url:    `/chats/${chatId}/messages/${messageId}`,
        method: 'DELETE',
      }),
    }),

    addReaction: builder.mutation({
      query: ({ chatId, messageId, emoji }) => ({
        url:    `/chats/${chatId}/messages/${messageId}/reactions`,
        method: 'POST',
        body:   { emoji },
      }),
    }),

    removeReaction: builder.mutation({
      query: ({ chatId, messageId }) => ({
        url:    `/chats/${chatId}/messages/${messageId}/reactions`,
        method: 'DELETE',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMyChatsQuery,
  useGetOrCreateDirectMutation,
  useCreateGroupMutation,
  useMarkReadMutation,
  useLeaveChatMutation,
  useSendMediaMessageMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
  useTogglePinMutation,
  useToggleMuteMutation,
  useDeleteChatMutation,
} = chatApi;
