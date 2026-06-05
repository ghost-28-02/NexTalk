import { createSlice } from '@reduxjs/toolkit';

/**
 * notificationSlice — single source of truth for notification state.
 *
 * State shape:
 *   items[]       — loaded notifications, newest first
 *   unreadCount   — server-authoritative badge count (NOT derived from items
 *                   because items are paginated — only a page is loaded)
 *   hasMore       — cursor pagination
 *   nextCursor    — ID of the oldest loaded notification (for load-more)
 *   isLoaded      — true after the first successful GET /notifications
 *
 * Why keep unreadCount separate from items.filter(!isRead).length?
 *   The notification list is paginated — we may only have 20 items loaded
 *   while the user has 150 unread. Counting from items would show "20" when
 *   the real count is "150". The server-authoritative count (seeded by
 *   GET /notifications/unread-count and maintained by socket events) is
 *   always accurate.
 */

const initialState = {
  items:       [],
  unreadCount: 0,
  hasMore:     false,
  nextCursor:  null,
  isLoaded:    false,
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,

  reducers: {
    /** Seed on initial GET /notifications load. */
    notificationsLoaded(state, { payload: { notifications, hasMore, nextCursor } }) {
      state.items      = notifications;
      state.hasMore    = hasMore    ?? false;
      state.nextCursor = nextCursor ?? null;
      state.isLoaded   = true;
    },

    /** Append older notifications when user scrolls up (load more). */
    olderNotificationsLoaded(state, { payload: { notifications, hasMore, nextCursor } }) {
      state.items      = [...state.items, ...notifications];
      state.hasMore    = hasMore    ?? false;
      state.nextCursor = nextCursor ?? null;
    },

    /**
     * New notification pushed by socket.
     * Prepends to items and increments the badge.
     */
    notificationReceived(state, { payload: notification }) {
      const { skipCount, ...notif } = notification;
      const exists = state.items.some(
        (n) => n.id?.toString() === notif.id?.toString()
      );
      if (!exists) {
        state.items = [notif, ...state.items];
      }
      // Don't count message-type notifications in the bell badge
      if (!skipCount) {
        state.unreadCount += 1;
      }
    },

    /** Mark one notification as read (optimistic — reflected immediately). */
    notificationMarkedRead(state, { payload: notificationId }) {
      const n = state.items.find(
        (n) => n.id?.toString() === notificationId?.toString()
      );
      if (n && !n.isRead) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },

    /**
     * Mark all as read — triggered by PATCH /read-all or by the cross-device
     * socket event notification:read_all.
     */
    allNotificationsMarkedRead(state) {
      const now = new Date().toISOString();
      state.items.forEach((n) => {
        if (!n.isRead) {
          n.isRead = true;
          n.readAt = now;
        }
      });
      state.unreadCount = 0;
    },

    /** Remove a notification from the list (optimistic). */
    notificationDeleted(state, { payload: notificationId }) {
      const idx = state.items.findIndex(
        (n) => n.id?.toString() === notificationId?.toString()
      );
      if (idx !== -1) {
        if (!state.items[idx].isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.items.splice(idx, 1);
      }
    },

    /**
     * Set the badge count from the server.
     * Called on mount (GET /notifications/unread-count) and after reconnect.
     */
    unreadCountSet(state, { payload: count }) {
      state.unreadCount = typeof count === 'number' ? count : 0;
    },

    /** Hard reset on logout. */
    notificationStateReset() {
      return { ...initialState };
    },
  },
});

export const {
  notificationsLoaded,
  olderNotificationsLoaded,
  notificationReceived,
  notificationMarkedRead,
  allNotificationsMarkedRead,
  notificationDeleted,
  unreadCountSet,
  notificationStateReset,
} = notificationSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectNotifications         = (s) => s.notification.items;
export const selectNotificationUnreadCount = (s) => s.notification.unreadCount;
export const selectHasMoreNotifications  = (s) => s.notification.hasMore;
export const selectNextNotificationCursor = (s) => s.notification.nextCursor;
export const selectNotificationsLoaded   = (s) => s.notification.isLoaded;

export default notificationSlice.reducer;
