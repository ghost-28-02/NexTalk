'use client';

/**
 * SocketProvider — manages the entire Socket.IO connection lifecycle.
 *
 * Responsibilities:
 *   1. Create the socket when the user becomes authenticated
 *   2. Destroy (disconnect) the socket on logout
 *   3. Update socket.auth.token when the access token refreshes
 *   4. Handle connect_error → auto-refresh token on TOKEN_EXPIRED
 *   5. Register global event handlers (presence, notifications, system)
 *   6. Sync reconnect state into Redux (socketSlice)
 *   7. On reconnect: request bulk presence update
 *
 * Provider tree position: inside <Provider store={store}> at the root layout.
 * The socket activates only when isAuthenticated becomes true.
 *
 * Separation of concerns:
 *   - This provider handles the connection lifecycle and global events only.
 *   - Chat/call-specific event subscriptions live in their feature hooks
 *     (useChatSocket, useCallSocket) which receive the socket via useSocket().
 *   - Components never interact with socket.io-client directly.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { SocketContext } from '../context/SocketContext';
import { createSocket } from '../services/socketService';
import {
  socketConnecting,
  socketConnected,
  socketReconnecting,
  socketDisconnected,
  socketError,
  socketReset,
} from '../store/socketSlice';
import {
  userCameOnline,
  userWentOffline,
  userStatusChanged,
  bulkPresenceUpdated,
  presenceReset,
} from '../../presence/store/presenceSlice';
import { PRESENCE_EVENTS, SYSTEM_EVENTS } from '../constants/socketEvents';
import { tokenRefreshed, clearAuth } from '../../auth/store/authSlice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REFRESH_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`;

/**
 * Silently call POST /auth/refresh (refresh cookie auto-sent).
 * Returns the new accessToken or null on failure.
 */
async function silentRefresh() {
  try {
    const res = await fetch(REFRESH_URL, {
      method: 'POST',
      credentials: 'include',  // send httpOnly refresh cookie
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data?.accessToken ?? null;
  } catch {
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SocketProvider({ children }) {
  const dispatch = useDispatch();

  // Auth state — drives socket lifecycle
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const accessToken     = useSelector((s) => s.auth.accessToken);

  // socketRef — stable reference used inside effects and event handlers (no stale closures)
  // socketState — drives context re-renders so consumers get the updated instance
  const socketRef   = useRef(null);
  const [socketState, setSocketState] = useState(null);

  // ── Reconnect on connect_error ────────────────────────────────────────────

  /**
   * Attempt a silent token refresh then reconnect.
   * Called when the server rejects the handshake with TOKEN_EXPIRED.
   */
  const handleTokenExpired = useCallback(async () => {
    const newToken = await silentRefresh();
    if (!newToken) {
      // Refresh failed — session is gone, log the user out
      dispatch(clearAuth());
      return;
    }
    dispatch(tokenRefreshed(newToken));
    const socket = socketRef.current;
    if (socket) {
      socket.auth.token = newToken;
      socket.connect();
    }
  }, [dispatch]);

  // ── Register global event handlers ────────────────────────────────────────
  // Called once after socket is created. Returns a cleanup function.

  const registerGlobalHandlers = useCallback((socket) => {
    // ── Connection lifecycle ─────────────────────────────────────────────────

    const onConnect = () => {
      dispatch(socketConnected());

      // On reconnect: request bulk presence for all tracked users
      // (contact list IDs would be passed here in a future enhancement)
      // socket.emit(PRESENCE_EVENTS.BULK_STATUS, { userIds: [...contactIds] }, ...)
    };

    const onDisconnect = (reason) => {
      // 'io server disconnect' = server kicked the client (e.g., auth failure)
      // 'io client disconnect' = client explicitly called socket.disconnect()
      // Everything else = network drop, will auto-reconnect
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        dispatch(socketDisconnected());
      }
      // For network drops, reconnect_attempt fires next — we show 'reconnecting'
    };

    const onConnectError = (err) => {
      const code = err?.data?.code;

      if (code === 'TOKEN_EXPIRED') {
        // Short-lived token expired while socket was idle — refresh silently
        handleTokenExpired();
        return;
      }

      if (code === 'ACCOUNT_DISABLED') {
        // Terminal error — no point retrying
        dispatch(socketError('Your account has been disabled'));
        dispatch(clearAuth());
        socket.disconnect();
        return;
      }

      // TOKEN_MISSING or TOKEN_INVALID — auth state is corrupt
      if (code === 'TOKEN_MISSING' || code === 'TOKEN_INVALID') {
        dispatch(socketError('Authentication failed'));
        dispatch(clearAuth());
        socket.disconnect();
        return;
      }

      // Network-level connect error — Socket.IO will auto-retry
      // socketReconnecting will fire from the reconnect_attempt event
    };

    const onReconnectAttempt = () => {
      dispatch(socketReconnecting());
    };

    const onReconnectFailed = () => {
      // All reconnection attempts exhausted
      dispatch(socketError('Could not reconnect. Please check your connection.'));
    };

    // ── Presence ──────────────────────────────────────────────────────────────

    const onUserOnline = ({ userId }) => {
      dispatch(userCameOnline(userId));
    };

    const onUserOffline = ({ userId, lastSeenAt }) => {
      dispatch(userWentOffline({ userId, lastSeenAt }));
    };

    const onStatusChange = ({ userId, status }) => {
      dispatch(userStatusChanged({ userId, status }));
    };

    // ── System ────────────────────────────────────────────────────────────────

    const onTokenExpiredMidSession = () => {
      // Server proactively pushes this event when it detects the token has expired
      // (e.g., after a logoutAll from another device). Refresh and re-auth.
      handleTokenExpired();
    };

    // Register all handlers
    socket.on('connect',                     onConnect);
    socket.on('disconnect',                  onDisconnect);
    socket.on('connect_error',               onConnectError);
    socket.on('reconnect_attempt',           onReconnectAttempt);
    socket.on('reconnect_failed',            onReconnectFailed);
    socket.on(PRESENCE_EVENTS.USER_ONLINE,   onUserOnline);
    socket.on(PRESENCE_EVENTS.USER_OFFLINE,  onUserOffline);
    socket.on(PRESENCE_EVENTS.STATUS_CHANGE, onStatusChange);
    socket.on(SYSTEM_EVENTS.TOKEN_EXPIRED,   onTokenExpiredMidSession);

    // Return cleanup function
    return () => {
      socket.off('connect',                     onConnect);
      socket.off('disconnect',                  onDisconnect);
      socket.off('connect_error',               onConnectError);
      socket.off('reconnect_attempt',           onReconnectAttempt);
      socket.off('reconnect_failed',            onReconnectFailed);
      socket.off(PRESENCE_EVENTS.USER_ONLINE,   onUserOnline);
      socket.off(PRESENCE_EVENTS.USER_OFFLINE,  onUserOffline);
      socket.off(PRESENCE_EVENTS.STATUS_CHANGE, onStatusChange);
      socket.off(SYSTEM_EVENTS.TOKEN_EXPIRED,   onTokenExpiredMidSession);
    };
  }, [dispatch, handleTokenExpired]);

  // ── Socket lifecycle ──────────────────────────────────────────────────────
  // Creates / destroys the socket in response to auth state changes.

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // User logged out or session not yet restored
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketState(null);
        dispatch(socketReset());
        dispatch(presenceReset());
      }
      return;
    }

    // User is authenticated — create and connect
    dispatch(socketConnecting());
    const socket = createSocket(accessToken);
    socketRef.current = socket;
    setSocketState(socket);

    const cleanup = registerGlobalHandlers(socket);
    socket.connect();

    return () => {
      cleanup();
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // accessToken is intentionally excluded: token refresh should NOT recreate
    // the socket. Only isAuthenticated changing (login/logout) triggers a new socket.
    // Token updates are handled by the effect below.
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Token refresh (mid-session) ───────────────────────────────────────────
  // When baseQueryWithReauth refreshes the access token, update socket.auth.token
  // so the next reconnect attempt uses the new token. We do NOT reconnect here —
  // the socket is still connected and doesn't need to re-auth mid-session.

  useEffect(() => {
    const socket = socketRef.current;
    if (socket && accessToken) {
      socket.auth.token = accessToken;
    }
  }, [accessToken]);

  return (
    <SocketContext.Provider value={socketState}>
      {children}
    </SocketContext.Provider>
  );
}
