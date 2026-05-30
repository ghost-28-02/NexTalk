'use client';

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
  presenceReset,
} from '../../presence/store/presenceSlice';
import { PRESENCE_EVENTS, SYSTEM_EVENTS } from '../constants/socketEvents';
import { clearAuth } from '../../auth/store/authSlice';

export function SocketProvider({ children }) {
  const dispatch        = useDispatch();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const socketToken     = useSelector((s) => s.auth.socketToken);

  const socketRef   = useRef(null);
  const [socketState, setSocketState] = useState(null);

  const registerGlobalHandlers = useCallback((socket) => {
    const onConnect         = () => { dispatch(socketConnected()); };
    const onReconnectAttempt = () => { dispatch(socketReconnecting()); };
    const onReconnectFailed  = () => { dispatch(socketError('Could not reconnect. Please check your connection.')); };

    const onDisconnect = (reason) => {
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        dispatch(socketDisconnected());
      }
    };

    const onConnectError = (err) => {
      const code = err?.data?.code;
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID' || code === 'TOKEN_MISSING') {
        dispatch(clearAuth());
        socket.disconnect();
        return;
      }
      if (code === 'ACCOUNT_DISABLED') {
        dispatch(socketError('Your account has been disabled'));
        dispatch(clearAuth());
        socket.disconnect();
      }
    };

    const onUserOnline   = ({ userId }) => { dispatch(userCameOnline(userId)); };
    const onUserOffline  = ({ userId, lastSeenAt }) => { dispatch(userWentOffline({ userId, lastSeenAt })); };
    const onStatusChange = ({ userId, status }) => { dispatch(userStatusChanged({ userId, status })); };
    const onTokenExpired = () => { dispatch(clearAuth()); socket.disconnect(); };

    socket.on('connect',                     onConnect);
    socket.on('disconnect',                  onDisconnect);
    socket.on('connect_error',               onConnectError);
    socket.on('reconnect_attempt',           onReconnectAttempt);
    socket.on('reconnect_failed',            onReconnectFailed);
    socket.on(PRESENCE_EVENTS.USER_ONLINE,   onUserOnline);
    socket.on(PRESENCE_EVENTS.USER_OFFLINE,  onUserOffline);
    socket.on(PRESENCE_EVENTS.STATUS_CHANGE, onStatusChange);
    socket.on(SYSTEM_EVENTS.TOKEN_EXPIRED,   onTokenExpired);

    return () => {
      socket.off('connect',                     onConnect);
      socket.off('disconnect',                  onDisconnect);
      socket.off('connect_error',               onConnectError);
      socket.off('reconnect_attempt',           onReconnectAttempt);
      socket.off('reconnect_failed',            onReconnectFailed);
      socket.off(PRESENCE_EVENTS.USER_ONLINE,   onUserOnline);
      socket.off(PRESENCE_EVENTS.USER_OFFLINE,  onUserOffline);
      socket.off(PRESENCE_EVENTS.STATUS_CHANGE, onStatusChange);
      socket.off(SYSTEM_EVENTS.TOKEN_EXPIRED,   onTokenExpired);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated || !socketToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketState(null);
        dispatch(socketReset());
        dispatch(presenceReset());
      }
      return;
    }

    dispatch(socketConnecting());
    const socket = createSocket(socketToken);
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
  }, [isAuthenticated, socketToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={socketState}>
      {children}
    </SocketContext.Provider>
  );
}
