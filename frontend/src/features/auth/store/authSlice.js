import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
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
      state.isAuthenticated = true;
      state.isInitialized = true;
    },

    clearAuth(state) {
      state.user = null;
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
