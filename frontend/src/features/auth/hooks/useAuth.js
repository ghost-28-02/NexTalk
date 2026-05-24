import { useSelector } from 'react-redux';
import {
  selectUser,
  selectIsAuthenticated,
  selectIsInitialized,
  selectPendingEmail,
  selectUserRole,
  selectIsAdmin,
  selectIsEmailVerified,
} from '../store/authSelectors';

/**
 * Convenience hook for consuming auth state in components.
 * Keeps components decoupled from the Redux selector implementation.
 */
export function useAuth() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isInitialized = useSelector(selectIsInitialized);
  const pendingEmail = useSelector(selectPendingEmail);
  const role = useSelector(selectUserRole);
  const isAdmin = useSelector(selectIsAdmin);
  const isEmailVerified = useSelector(selectIsEmailVerified);

  return {
    user,
    isAuthenticated,
    isInitialized,
    pendingEmail,
    role,
    isAdmin,
    isEmailVerified,
  };
}
