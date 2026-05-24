// Auth feature barrel exports
export { useAuth } from './hooks/useAuth';
export { useAuthInit } from './hooks/useAuthInit';
export { AuthGuard } from './guards/AuthGuard';
export { GuestGuard } from './guards/GuestGuard';
export {
  setCredentials,
  tokenRefreshed,
  clearAuth,
  authInitialized,
  setPendingEmail,
  clearPendingEmail,
  updateUser,
} from './store/authSlice';
export * from './store/authSelectors';
export {
  useSignupMutation,
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetMeQuery,
} from './services/authApi';
