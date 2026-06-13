'use client';

/**
 * useCallSocket — GLOBAL inbound-call listener.
 *
 * Mounted once in AppProviders (like useNotificationSocket) so an incoming
 * call rings no matter which page the user is on.
 *
 * Owns only the pre-call lifecycle:
 *   INCOMING — show the ringing modal (or auto-reject 'busy' if already in a call)
 *   ENDED    — caller cancelled while we were still ringing → dismiss modal
 *
 * Everything DURING a call (offer/answer/ICE/accepted/rejected/ended) is
 * owned by useWebRTC on the call page — same "refs keep closures fresh"
 * pattern as useChatSocket.
 */

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSocket } from '@/features/socket';
import { CALL_EVENTS } from '@/features/socket/constants/socketEvents';
import {
  incomingCallReceived,
  callReset,
  selectCallStatus,
} from '../store/callSlice';

export function useCallSocket() {
  const dispatch = useDispatch();
  const socket   = useSocket();
  const status   = useSelector(selectCallStatus);

  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = (payload) => {
      // Already ringing / in a call → tell the second caller we're busy
      if (statusRef.current !== 'idle') {
        socket.emit(CALL_EVENTS.REJECT, {
          callId:       payload.callId,
          targetUserId: payload.caller.id,
          reason:       'busy',
        });
        return;
      }
      dispatch(incomingCallReceived(payload));
    };

    // Caller hung up before we answered → dismiss the ringing modal.
    // (ENDED during connecting/active is handled by useWebRTC on the call page.)
    const onEnded = () => {
      if (statusRef.current === 'incoming') dispatch(callReset());
    };

    socket.on(CALL_EVENTS.INCOMING, onIncoming);
    socket.on(CALL_EVENTS.ENDED,    onEnded);

    return () => {
      socket.off(CALL_EVENTS.INCOMING, onIncoming);
      socket.off(CALL_EVENTS.ENDED,    onEnded);
    };
  }, [socket, dispatch]);
}
