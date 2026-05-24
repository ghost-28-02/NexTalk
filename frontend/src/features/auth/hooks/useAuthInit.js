import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRefreshMutation } from '../services/authApi';
import { selectIsInitialized } from '../store/authSelectors';
import { authInitialized } from '../store/authSlice';

/**
 * Fires once on app mount to restore the user's session.
 *
 * Strategy: POST /auth/refresh
 *   - The httpOnly refresh token cookie is auto-sent by the browser.
 *   - If it's still valid → server responds with { accessToken, user }.
 *     The `refresh` mutation's onQueryStarted dispatches setCredentials.
 *   - If the cookie is expired or missing → server returns 401.
 *     The `refresh` mutation's onQueryStarted dispatches clearAuth.
 *   - Either way → isInitialized is set to true → app renders.
 *
 * Called from AuthInitializer inside AppProviders — runs exactly once per page load.
 */
export function useAuthInit() {
  const dispatch = useDispatch();
  const isInitialized = useSelector(selectIsInitialized);
  const [refresh] = useRefreshMutation();
  const dispatchRef = useRef(dispatch);
  const initializedRef = useRef(isInitialized);
  const refreshRef = useRef(refresh);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    initializedRef.current = isInitialized;
  }, [isInitialized]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (initializedRef.current) return;

    let cancelled = false;

    const restoreSession = async () => {
      try {
        await refreshRef.current();
      } finally {
        if (!cancelled) {
          dispatchRef.current(authInitialized());
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);
}
