import { createSlice } from '@reduxjs/toolkit';

/**
 * presenceSlice — realtime online/offline state for all users.
 *
 * Shape:
 *   statuses:   { [userId]: 'online' | 'offline' | 'away' | 'busy' }
 *   lastSeenAt: { [userId]: ISO-8601 string | null }
 *
 * Updated by:
 *   SocketProvider → presence:user_online  → userCameOnline
 *   SocketProvider → presence:user_offline → userWentOffline
 *   SocketProvider → presence:status_change → userStatusChanged
 *   SocketProvider → presence:bulk_status callback → bulkPresenceUpdated
 *
 * Consumed by:
 *   usePresence(userId) hook → returns { status, lastSeenAt }
 *   UserAvatar, ChatListItem, ContactItem, etc.
 */

const initialState = {
  statuses:   {},  // { [userId: string]: string }
  lastSeenAt: {},  // { [userId: string]: string | null }
};

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    userCameOnline(state, { payload: userId }) {
      state.statuses[userId]   = 'online';
      state.lastSeenAt[userId] = null;
    },

    userWentOffline(state, { payload: { userId, lastSeenAt } }) {
      state.statuses[userId]   = 'offline';
      state.lastSeenAt[userId] = lastSeenAt ?? null;
    },

    userStatusChanged(state, { payload: { userId, status } }) {
      state.statuses[userId] = status;
    },

    /**
     * Bulk update from presence:bulk_status response.
     * payload: { [userId]: 'online' | 'offline' | ... }
     */
    bulkPresenceUpdated(state, { payload: statuses }) {
      for (const [userId, status] of Object.entries(statuses)) {
        state.statuses[userId] = status;
      }
    },

    presenceReset() {
      return initialState;
    },
  },
});

export const {
  userCameOnline,
  userWentOffline,
  userStatusChanged,
  bulkPresenceUpdated,
  presenceReset,
} = presenceSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectPresenceStatus = (userId) => (state) =>
  state.presence.statuses[userId] ?? 'offline';

export const selectPresenceLastSeen = (userId) => (state) =>
  state.presence.lastSeenAt[userId] ?? null;

export const selectIsOnline = (userId) => (state) =>
  state.presence.statuses[userId] === 'online';

export const selectAllPresence = (state) => state.presence.statuses;

export default presenceSlice.reducer;
