export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsInitialized = (state) => state.auth.isInitialized;
export const selectPendingEmail = (state) => state.auth.pendingEmail;

// Role-based selectors — ready for future admin/moderator routes
export const selectUserRole = (state) => state.auth.user?.role ?? null;
export const selectIsAdmin = (state) => state.auth.user?.role === 'admin';
export const selectIsEmailVerified = (state) => state.auth.user?.isEmailVerified ?? false;
