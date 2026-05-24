import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitialized: false, // true after first session-restore attempt completes
  pendingEmail: null,   // set during signup → verify-email flow, cleared after verification
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, { payload }) {
      state.user = payload.user;
      state.accessToken = payload.accessToken;
      state.isAuthenticated = true;
      state.isInitialized = true;
    },

    tokenRefreshed(state, { payload }) {
      state.accessToken = payload;
    },

    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
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
  tokenRefreshed,
  clearAuth,
  authInitialized,
  setPendingEmail,
  clearPendingEmail,
  updateUser,
} = authSlice.actions;

export default authSlice.reducer;
