'use client';

import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { callSocket } from '../services/callSocket';
import { useWebRTC } from './useWebRTC';
import { useCallState } from './useCallState';
import { useCallTimer } from './useCallTimer';
import {
  callInitiated,
  callAccepted,
  callEnded,
  callDeclined,
  callReset,
  toggleMute,
  toggleVideo,
} from '../store/callSlice';
import { generateCallId } from '../utils/callUtils';
import { CALL_TYPE } from '../constants/callConstants';

/**
 * Primary hook for video call lifecycle.
 * Extends audio lifecycle with camera toggle and screen sharing.
 *
 * @param {import('socket.io-client').Socket | null} socket
 */
export function useVideoCall(socket) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { callId, isMuted, isVideoOff, isScreenSharing, remoteParticipant } = useCallState();
  const webrtc = useWebRTC(socket);
  useCallTimer();

  const initiateCall = useCallback(
    async (receiverInfo, callerInfo) => {
      const newCallId = generateCallId();
      dispatch(
        callInitiated({
          callId: newCallId,
          callType: CALL_TYPE.VIDEO,
          direction: 'outgoing',
          callerInfo,
          receiverInfo,
        }),
      );
      await webrtc.initLocalStream(CALL_TYPE.VIDEO);
      callSocket.initiateCall({
        callId: newCallId,
        callType: CALL_TYPE.VIDEO,
        receiverId: receiverInfo.id,
      });
      await webrtc.startCall();
      router.push('/call/video');
    },
    [dispatch, router, webrtc],
  );

  const answerCall = useCallback(async () => {
    dispatch(callAccepted());
    await webrtc.initLocalStream(CALL_TYPE.VIDEO);
    callSocket.acceptCall({ callId });
  }, [dispatch, callId, webrtc]);

  const declineCall = useCallback(() => {
    callSocket.declineCall({ callId });
    dispatch(callDeclined());
    setTimeout(() => dispatch(callReset()), 2000);
  }, [dispatch, callId]);

  const endCall = useCallback(() => {
    callSocket.endCall({ callId });
    dispatch(callEnded());
    router.push('/chat');
  }, [dispatch, callId, router]);

  const handleToggleMute = useCallback(() => {
    dispatch(toggleMute());
    webrtc.toggleMuteTrack(!isMuted);
  }, [dispatch, isMuted, webrtc]);

  const handleToggleVideo = useCallback(() => {
    dispatch(toggleVideo());
    webrtc.toggleVideoTrack(!isVideoOff);
  }, [dispatch, isVideoOff, webrtc]);

  const handleToggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        await webrtc.stopScreenShare();
      } else {
        await webrtc.startScreenShare();
      }
    } catch (err) {
      // User cancelled the getDisplayMedia picker — not an error
      if (err?.name !== 'NotAllowedError') console.error('[VideoCall] Screen share error', err);
    }
  }, [isScreenSharing, webrtc]);

  return {
    remoteParticipant,
    localStream: webrtc.localStream,
    remoteStream: webrtc.remoteStream,
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute: handleToggleMute,
    toggleVideo: handleToggleVideo,
    toggleScreenShare: handleToggleScreenShare,
  };
}
