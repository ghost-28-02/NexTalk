import { baseApi } from '@/services/baseApi';
import {
  notificationsLoaded,
  olderNotificationsLoaded,
  notificationMarkedRead,
  allNotificationsMarkedRead,
  notificationDeleted,
  unreadCountSet,
} from '../store/notificationSlice';

/**
 * notificationApi — RTK Query endpoints for notifications.
 *
 * Design notes:
 *   - RTK Query only seeds notificationSlice via onQueryStarted.
 *     The slice (not the RTK Query cache) is the source of truth — identical
 *     to the chat/message pattern. This avoids fighting RTK Query's cache
 *     invalidation when socket events mutate state between requests.
 *   - Mutations apply optimistic updates immediately; errors are silent
 *     (the next badge sync / page reload reconciles).
 *   - Pagination: initial load uses no `before` param; load-more passes the
 *     nextCursor from the slice as `before`.
 */
export const notificationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ── Read ────────────────────────────────────────────────────────────────

    getNotifications: build.query({
      query: ({ limit = 20, before } = {}) => ({
        url: '/notifications',
        params: { limit, ...(before ? { before } : {}) },
      }),
      async onQueryStarted({ before } = {}, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const { notifications, hasMore, nextCursor } = data.data;
          if (before) {
            dispatch(olderNotificationsLoaded({ notifications, hasMore, nextCursor }));
          } else {
            dispatch(notificationsLoaded({ notifications, hasMore, nextCursor }));
          }
        } catch { /* network error — slice keeps previous state */ }
      },
    }),

    getUnreadCount: build.query({
      query: () => '/notifications/unread-count',
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(unreadCountSet(data.data.count));
        } catch {}
      },
    }),

    // ── Mutations ───────────────────────────────────────────────────────────

    markNotificationRead: build.mutation({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: 'PATCH',
      }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        // Optimistic: mark read immediately in the slice
        dispatch(notificationMarkedRead(id));
        try {
          await queryFulfilled;
        } catch { /* silent — badge will resync on next getUnreadCount */ }
      },
    }),

    markAllNotificationsRead: build.mutation({
      query: () => ({
        url: '/notifications/read-all',
        method: 'PATCH',
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        dispatch(allNotificationsMarkedRead());
        try {
          await queryFulfilled;
        } catch {}
      },
    }),

    deleteNotification: build.mutation({
      query: (id) => ({
        url: `/notifications/${id}`,
        method: 'DELETE',
      }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        dispatch(notificationDeleted(id));
        try {
          await queryFulfilled;
        } catch {}
      },
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} = notificationApi;
