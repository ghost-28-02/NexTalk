/**
 * callSocket — thin emit wrapper for call-related socket events.
 *
 * Initialized by calling initCallSocket(socket) from SocketProvider
 * or from useCallSocket after the socket becomes available.
 *
 * All emit methods are no-ops when the socket is not connected —
 * the caller does not need to guard against this.
 */

import { SOCKET_EVENTS } from '../constants/callConstants';

let _socket = null;

/** Called once the socket is connected and available. */
export function initCallSocket(socket) {
  _socket = socket;
}

export function getCallSocket() {
  return _socket;
}

function emit(event, data) {
  if (!_socket?.connected) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[CallSocket] Socket not connected — cannot emit "${event}"`);
    }
    return;
  }
  _socket.emit(event, data);
}

/**
 * Thin wrappers so the rest of the call feature never imports SOCKET_EVENTS directly.
 * Each function maps 1-to-1 to a backend socket handler.
 */
export const callSocket = {
  /** Step 1 — caller starts the call flow */
  initiateCall({ callId, callType, receiverId, sdpOffer }) {
    emit(SOCKET_EVENTS.CALL_INITIATE, { callId, callType, targetUserId: receiverId, sdpOffer });
  },

  /** Step 2a — receiver accepts */
  acceptCall({ callId, sdpAnswer }) {
    emit(SOCKET_EVENTS.CALL_ACCEPT, { callId, sdpAnswer });
  },

  /** Step 2b — receiver declines */
  declineCall({ callId }) {
    emit(SOCKET_EVENTS.CALL_DECLINE, { callId });
  },

  /** Either side ends an active call */
  endCall({ callId }) {
    emit(SOCKET_EVENTS.CALL_END, { callId });
  },

  /** WebRTC: send SDP offer to remote peer via server relay */
  sendOffer({ callId, sdp }) {
    emit(SOCKET_EVENTS.OFFER, { callId, sdpOffer: sdp });
  },

  /** WebRTC: send SDP answer to remote peer via server relay */
  sendAnswer({ callId, sdp }) {
    emit(SOCKET_EVENTS.ANSWER, { callId, sdpAnswer: sdp });
  },

  /** WebRTC: trickle ICE candidate to remote peer */
  sendIceCandidate({ callId, candidate }) {
    emit(SOCKET_EVENTS.ICE_CANDIDATE, { callId, candidate });
  },

  /** Notify remote peer that local user toggled mute */
  notifyMuteState({ callId, muted }) {
    emit(SOCKET_EVENTS.NOTIFY_MUTED, { callId, muted });
  },

  /** Notify remote peer that local user toggled camera */
  notifyVideoState({ callId, videoOff }) {
    emit(SOCKET_EVENTS.NOTIFY_VIDEO_OFF, { callId, videoOff });
  },

  /** Attempt reconnect after ICE failure */
  reconnect({ callId }) {
    emit(SOCKET_EVENTS.CALL_RECONNECT, { callId });
  },
};
