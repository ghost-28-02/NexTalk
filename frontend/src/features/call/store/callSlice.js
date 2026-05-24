import { createSlice } from '@reduxjs/toolkit';
import { CALL_STATE } from '../constants/callConstants';

const initialActiveCall = {
  callState: CALL_STATE.IDLE,
  callType: null,       // 'audio' | 'video'
  direction: null,      // 'incoming' | 'outgoing'
  callId: null,
  callerInfo: null,     // { id, name, avatar }
  receiverInfo: null,   // { id, name, avatar }
  startedAt: null,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  isSpeakerOn: false,
  isRemoteMuted: false,
  isRemoteVideoOff: false,
  duration: 0,
  error: null,
};

const initialState = {
  ...initialActiveCall,
  callHistory: [],  // persisted across calls within the session
};

function buildHistoryEntry(state, outcome) {
  return {
    callId: state.callId,
    callType: state.callType,
    direction: state.direction,
    callerInfo: state.callerInfo,
    receiverInfo: state.receiverInfo,
    startedAt: state.startedAt,
    endedAt: Date.now(),
    duration: state.duration,
    outcome,
  };
}

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    // Caller fires this; direction='outgoing'. Remote fires this via socket; direction='incoming'.
    callInitiated(state, { payload }) {
      const { callId, callType, direction, callerInfo, receiverInfo } = payload;
      state.callState =
        direction === 'outgoing' ? CALL_STATE.OUTGOING : CALL_STATE.RINGING;
      state.callType = callType;
      state.direction = direction;
      state.callId = callId;
      state.callerInfo = callerInfo;
      state.receiverInfo = receiverInfo;
      state.error = null;
    },

    // Receiver taps Answer — moves to CONNECTING while WebRTC negotiates
    callAccepted(state) {
      state.callState = CALL_STATE.CONNECTING;
    },

    // WebRTC peer connection reaches 'connected' state
    callConnected(state) {
      state.callState = CALL_STATE.CONNECTED;
      state.startedAt = Date.now();
    },

    callDeclined(state) {
      const entry = buildHistoryEntry(state, 'declined');
      state.callHistory.unshift(entry);
      Object.assign(state, initialActiveCall);
      state.callState = CALL_STATE.DECLINED;
    },

    callEnded(state) {
      const entry = buildHistoryEntry(state, 'ended');
      state.callHistory.unshift(entry);
      Object.assign(state, initialActiveCall);
    },

    callMissed(state) {
      const entry = buildHistoryEntry(state, 'missed');
      state.callHistory.unshift(entry);
      Object.assign(state, initialActiveCall);
      state.callState = CALL_STATE.MISSED;
    },

    callFailed(state, { payload }) {
      state.callState = CALL_STATE.FAILED;
      state.error = payload ?? 'Call failed';
    },

    // Fired when ICE connection drops — triggers reconnect attempt
    callReconnecting(state) {
      state.callState = CALL_STATE.RECONNECTING;
    },

    // Full reset after error/dismiss; preserves history
    callReset(state) {
      const history = state.callHistory;
      Object.assign(state, initialState);
      state.callHistory = history;
    },

    toggleMute(state) {
      state.isMuted = !state.isMuted;
    },

    toggleVideo(state) {
      state.isVideoOff = !state.isVideoOff;
    },

    toggleSpeaker(state) {
      state.isSpeakerOn = !state.isSpeakerOn;
    },

    setScreenSharing(state, { payload }) {
      state.isScreenSharing = payload;
    },

    setRemoteMuted(state, { payload }) {
      state.isRemoteMuted = payload;
    },

    setRemoteVideoOff(state, { payload }) {
      state.isRemoteVideoOff = payload;
    },

    // Fired every second from useCallTimer
    setDuration(state, { payload }) {
      state.duration = payload;
    },

    // For seeding history from backend on mount
    callHistoryLoaded(state, { payload }) {
      state.callHistory = payload;
    },
  },
});

export const {
  callInitiated,
  callAccepted,
  callConnected,
  callDeclined,
  callEnded,
  callMissed,
  callFailed,
  callReconnecting,
  callReset,
  toggleMute,
  toggleVideo,
  toggleSpeaker,
  setScreenSharing,
  setRemoteMuted,
  setRemoteVideoOff,
  setDuration,
  callHistoryLoaded,
} = callSlice.actions;

export default callSlice.reducer;
