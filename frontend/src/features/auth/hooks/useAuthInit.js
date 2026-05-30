import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLazyGetMeQuery } from '../services/authApi';
import { selectIsInitialized } from '../store/authSelectors';
import { authInitialized } from '../store/authSlice';

/**
 * Fires once on app mount to restore the user's session.
 *
 * Strategy: GET /auth/me
 *   - The httpOnly JWT cookie is auto-sent by the browser.
 *   - If valid → server returns user data → setCredentials is dispatched.
 *   - If cookie missing or expired → server returns 401 → clearAuth is dispatched.
 *   - Either way → isInitialized is set to true → app renders.
 */
export function useAuthInit() {
  const dispatch = useDispatch();
  const isInitialized = useSelector(selectIsInitialized);
  const [getMe] = useLazyGetMeQuery();
  const dispatchRef = useRef(dispatch);
  const initializedRef = useRef(isInitialized);
  const getMeRef = useRef(getMe);

  useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);
  useEffect(() => { initializedRef.current = isInitialized; }, [isInitialized]);
  useEffect(() => { getMeRef.current = getMe; }, [getMe]);

  useEffect(() => {
    if (initializedRef.current) return;

    let cancelled = false;

    const restoreSession = async () => {
      try {
        await getMeRef.current();
      } finally {
        if (!cancelled) {
          dispatchRef.current(authInitialized());
        }
      }
    };

    void restoreSession();

    return () => { cancelled = true; };
  }, []);
}
