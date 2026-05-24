'use client';

/**
 * useCallSocket — subscribes to all call-related socket events.
 *
 * Dispatches Redux actions in response to server-emitted call events.
 * Plug into your SocketProvider or a top-level component that has the socket:
 *
 *   const socket = useSocket();
 *   useCallSocket(socket);
 *
 * @param {import('socket.io-client').Socket | null} socket
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { SOCKET_EVENTS } from '../constants/callConstants';
import {
  callInitiated,
  callAccepted,
  callDeclined,
  callEnded,
  callMissed,
  setRemoteMuted,
  setRemoteVideoOff,
} from '../store/callSlice';

export function useCallSocket(socket) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!socket) return;

    const handlers = {
      // Server relays incoming call to the callee
      [SOCKET_EVENTS.CALL_INCOMING]: (payload) =>
        dispatch(callInitiated({ ...payload, direction: 'incoming' })),

      // Callee accepted — caller gets this
      [SOCKET_EVENTS.CALL_ACCEPTED]: (payload) => dispatch(callAccepted(payload)),

      // Callee declined — caller gets this
      [SOCKET_EVENTS.CALL_DECLINED]: () => dispatch(callDeclined()),

      // Either side ended — both get this
      [SOCKET_EVENTS.CALL_ENDED]: () => dispatch(callEnded()),

      // Ring timeout — callee gets this
      [SOCKET_EVENTS.CALL_MISSED]: () => dispatch(callMissed()),

      // Remote peer toggled mute
      [SOCKET_EVENTS.REMOTE_MUTED]: ({ muted }) => dispatch(setRemoteMuted(muted)),

      // Remote peer toggled camera
      [SOCKET_EVENTS.REMOTE_VIDEO_OFF]: ({ videoOff }) => dispatch(setRemoteVideoOff(videoOff)),
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [socket, dispatch]);
}
