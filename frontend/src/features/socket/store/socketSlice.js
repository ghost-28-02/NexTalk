import { createSlice } from '@reduxjs/toolkit';

/**
 * socketSlice — tracks the lifecycle of the Socket.IO connection.
 *
 * status values:
 *   'idle'          — socket not yet created (user not authenticated)
 *   'connecting'    — socket.connect() called, waiting for ack
 *   'connected'     — socket is connected and authenticated
 *   'reconnecting'  — connection lost, auto-retry in progress
 *   'disconnected'  — manually disconnected (logout)
 *   'error'         — terminal failure (ACCOUNT_DISABLED, etc.)
 *
 * Components can observe status to render:
 *   'reconnecting' → "Reconnecting…" banner
 *   'error'        → show error message
 *   'connected'    → normal UI
 */

const initialState = {
  status: 'idle',
  reconnectAttempts: 0,
  error: null,            // terminal error message (string | null)
};

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    socketConnecting(state) {
      state.status = 'connecting';
      state.error = null;
    },

    socketConnected(state) {
      state.status = 'connected';
      state.reconnectAttempts = 0;
      state.error = null;
    },

    socketReconnecting(state) {
      state.status = 'reconnecting';
      state.reconnectAttempts += 1;
    },

    socketDisconnected(state) {
      state.status = 'disconnected';
      state.reconnectAttempts = 0;
    },

    socketError(state, { payload }) {
      state.status = 'error';
      state.error = payload ?? 'Connection error';
    },

    socketReset(state) {
      Object.assign(state, initialState);
    },
  },
});

export const {
  socketConnecting,
  socketConnected,
  socketReconnecting,
  socketDisconnected,
  socketError,
  socketReset,
} = socketSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectSocketStatus = (state) => state.socket.status;
export const selectIsSocketConnected = (state) => state.socket.status === 'connected';
export const selectSocketReconnecting = (state) => state.socket.status === 'reconnecting';
export const selectReconnectAttempts = (state) => state.socket.reconnectAttempts;
export const selectSocketError = (state) => state.socket.error;

export default socketSlice.reducer;
