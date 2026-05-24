'use client';

import { useSelector } from 'react-redux';
import {
  selectCallState,
  selectCallType,
  selectCallDirection,
  selectCallId,
  selectCallerInfo,
  selectReceiverInfo,
  selectIsMuted,
  selectIsVideoOff,
  selectIsScreenSharing,
  selectIsSpeakerOn,
  selectIsRemoteMuted,
  selectIsRemoteVideoOff,
  selectCallDuration,
  selectCallHistory,
  selectIsCallActive,
  selectIsIncomingCall,
  selectIsOutgoingCall,
  selectRemoteParticipant,
  selectMediaState,
  selectRemoteMediaState,
  selectHasActiveCall,
  selectCallError,
} from '../store/callSelectors';

/**
 * Convenience hook — returns a flat object of all call state.
 * Components that only need one or two values should import the
 * individual selectors directly to avoid unnecessary re-renders.
 */
export function useCallState() {
  return {
    // Core state machine
    callState: useSelector(selectCallState),
    callType: useSelector(selectCallType),
    direction: useSelector(selectCallDirection),
    callId: useSelector(selectCallId),
    // Participants
    callerInfo: useSelector(selectCallerInfo),
    receiverInfo: useSelector(selectReceiverInfo),
    remoteParticipant: useSelector(selectRemoteParticipant),
    // Media toggles
    isMuted: useSelector(selectIsMuted),
    isVideoOff: useSelector(selectIsVideoOff),
    isScreenSharing: useSelector(selectIsScreenSharing),
    isSpeakerOn: useSelector(selectIsSpeakerOn),
    // Remote peer media state
    isRemoteMuted: useSelector(selectIsRemoteMuted),
    isRemoteVideoOff: useSelector(selectIsRemoteVideoOff),
    // Timer
    duration: useSelector(selectCallDuration),
    // History
    callHistory: useSelector(selectCallHistory),
    // Derived booleans
    isCallActive: useSelector(selectIsCallActive),
    isIncomingCall: useSelector(selectIsIncomingCall),
    isOutgoingCall: useSelector(selectIsOutgoingCall),
    hasActiveCall: useSelector(selectHasActiveCall),
    mediaState: useSelector(selectMediaState),
    remoteMediaState: useSelector(selectRemoteMediaState),
    error: useSelector(selectCallError),
  };
}
