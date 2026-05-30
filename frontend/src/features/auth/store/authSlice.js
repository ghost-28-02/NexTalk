import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  socketToken: null,    // in-memory token for Socket.IO handshake (sockets can't use Next.js proxy)
  isAuthenticated: false,
  isInitialized: false,
  pendingEmail: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, { payload }) {
      state.user = payload.user;
      if (payload.socketToken) state.socketToken = payload.socketToken;
      state.isAuthenticated = true;
      state.isInitialized = true;
    },

    clearAuth(state) {
      state.user = null;
      state.socketToken = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
    },

    authInitialized(state) {
      state.isInitialized = true;
    },

    setPendingEmail(state, { payload }) {
      state.pendingEmail = payload;
    },

    clearPendingEmail(state) {
      state.pendingEmail = null;
    },

    updateUser(state, { payload }) {
      if (state.user) {
        state.user = { ...state.user, ...payload };
      }
    },
  },
});

export const {
  setCredentials,
  clearAuth,
  authInitialized,
  setPendingEmail,
  clearPendingEmail,
  updateUser,
} = authSlice.actions;

export default authSlice.reducer;
