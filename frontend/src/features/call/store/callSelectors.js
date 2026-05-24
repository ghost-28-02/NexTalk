import { createSelector } from '@reduxjs/toolkit';
import { CALL_STATE } from '../constants/callConstants';

// ─── Primitive selectors ────────────────────────────────────────────────────
export const selectCallState = (state) => state.call.callState;
export const selectCallType = (state) => state.call.callType;
export const selectCallDirection = (state) => state.call.direction;
export const selectCallId = (state) => state.call.callId;
export const selectCallerInfo = (state) => state.call.callerInfo;
export const selectReceiverInfo = (state) => state.call.receiverInfo;
export const selectIsMuted = (state) => state.call.isMuted;
export const selectIsVideoOff = (state) => state.call.isVideoOff;
export const selectIsScreenSharing = (state) => state.call.isScreenSharing;
export const selectIsSpeakerOn = (state) => state.call.isSpeakerOn;
export const selectIsRemoteMuted = (state) => state.call.isRemoteMuted;
export const selectIsRemoteVideoOff = (state) => state.call.isRemoteVideoOff;
export const selectCallDuration = (state) => state.call.duration;
export const selectCallStartedAt = (state) => state.call.startedAt;
export const selectCallHistory = (state) => state.call.callHistory;
export const selectCallError = (state) => state.call.error;

// ─── Derived / memoized selectors ────────────────────────────────────────────
export const selectIsCallActive = createSelector(
  selectCallState,
  (cs) =>
    cs === CALL_STATE.CONNECTED ||
    cs === CALL_STATE.CONNECTING ||
    cs === CALL_STATE.RECONNECTING,
);

export const selectIsIncomingCall = createSelector(
  selectCallState,
  (cs) => cs === CALL_STATE.RINGING,
);

export const selectIsOutgoingCall = createSelector(
  selectCallState,
  (cs) => cs === CALL_STATE.OUTGOING,
);

export const selectHasActiveCall = createSelector(
  selectCallState,
  (cs) => cs !== CALL_STATE.IDLE && cs !== CALL_STATE.ENDED,
);

// The person on the other side of the call (not the current user)
export const selectRemoteParticipant = createSelector(
  selectCallDirection,
  selectCallerInfo,
  selectReceiverInfo,
  (direction, callerInfo, receiverInfo) =>
    direction === 'incoming' ? callerInfo : receiverInfo,
);

// Snapshot of all media toggle states — used by controls components
export const selectMediaState = createSelector(
  selectIsMuted,
  selectIsVideoOff,
  selectIsScreenSharing,
  selectIsSpeakerOn,
  (isMuted, isVideoOff, isScreenSharing, isSpeakerOn) => ({
    isMuted,
    isVideoOff,
    isScreenSharing,
    isSpeakerOn,
  }),
);

// Remote participant's media state — used to show "muted / camera off" badges
export const selectRemoteMediaState = createSelector(
  selectIsRemoteMuted,
  selectIsRemoteVideoOff,
  (isRemoteMuted, isRemoteVideoOff) => ({ isRemoteMuted, isRemoteVideoOff }),
);
