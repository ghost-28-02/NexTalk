import { createSlice } from '@reduxjs/toolkit';

/**
 * callSlice — call state machine.
 *
 *   idle ──► outgoing ──► connecting ──► active ──► ended ──► idle
 *     │                      ▲                        ▲
 *     └────► incoming ───────┘   (any state) ─────────┘
 *
 * States:
 *   idle        — no call
 *   incoming    — callee: ringing modal visible
 *   outgoing    — caller: on the call page, waiting for accept/reject
 *   connecting  — accepted; WebRTC handshake (offer/answer/ICE) in flight
 *   active      — RTCPeerConnection connected, media flowing
 *   ended       — terminal screen ("Call ended", "Busy", …) before reset
 *
 * Media streams are NOT stored here — MediaStream objects are not
 * serializable. They live in useWebRTC refs; Redux holds only the
 * serializable call metadata + UI flags.
 */

const initialState = {
  status:    'idle',     // 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active' | 'ended'
  callId:    null,
  callType:  null,       // 'audio' | 'video'
  chatId:    null,
  isCaller:  false,
  peer:      null,       // { id, name, avatar }
  isMuted:     false,
  isCameraOff: false,
  startedAt:   null,     // ms epoch — set when status becomes 'active'
  endReason:   null,     // 'hangup' | 'rejected' | 'busy' | 'offline' | 'cancelled' | 'failed' | 'peer_disconnected'
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    /** Caller clicked the call button. Payload: { callId, callType, chatId, peer } */
    outgoingCallStarted(state, { payload }) {
      Object.assign(state, initialState);
      state.status   = 'outgoing';
      state.callId   = payload.callId;
      state.callType = payload.callType;
      state.chatId   = payload.chatId ?? null;
      state.peer     = payload.peer;
      state.isCaller = true;
    },

    /** CALL_EVENTS.INCOMING arrived. Payload: { callId, callType, chatId, caller } */
    incomingCallReceived(state, { payload }) {
      Object.assign(state, initialState);
      state.status   = 'incoming';
      state.callId   = payload.callId;
      state.callType = payload.callType;
      state.chatId   = payload.chatId ?? null;
      state.peer     = {
        id:     payload.caller.id,
        name:   payload.caller.name,
        avatar: payload.caller.avatar,
      };
      state.isCaller = false;
    },

    /** Callee tapped Accept (caller: ACCEPTED received). Handshake begins. */
    callConnecting(state) {
      state.status = 'connecting';
    },

    /** RTCPeerConnection reached 'connected'. */
    callConnected(state) {
      state.status    = 'active';
      state.startedAt = Date.now();
    },

    isMutedToggled(state) {
      state.isMuted = !state.isMuted;
    },

    isCameraOffToggled(state) {
      state.isCameraOff = !state.isCameraOff;
    },

    /** Terminal state — keeps peer/callType so the "ended" screen can render. */
    callEnded(state, { payload }) {
      state.status    = 'ended';
      state.endReason = payload?.reason ?? 'hangup';
    },

    /** Back to idle (leaving the call page / dismissing the ended screen). */
    callReset() {
      return initialState;
    },
  },
});

export const {
  outgoingCallStarted,
  incomingCallReceived,
  callConnecting,
  callConnected,
  isMutedToggled,
  isCameraOffToggled,
  callEnded,
  callReset,
} = callSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectCallStatus    = (s) => s.call.status;
export const selectCall          = (s) => s.call;
export const selectIsCallIdle    = (s) => s.call.status === 'idle';
export const selectIncomingCall  = (s) => (s.call.status === 'incoming' ? s.call : null);

export default callSlice.reducer;
