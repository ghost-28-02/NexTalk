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
  toggleSpeaker,
} from '../store/callSlice';
import { generateCallId } from '../utils/callUtils';
import { CALL_TYPE } from '../constants/callConstants';

/**
 * Primary hook for audio call lifecycle.
 * Composes callSocket + useWebRTC + Redux dispatches into a clean API.
 *
 * @param {import('socket.io-client').Socket | null} socket
 */
export function useAudioCall(socket) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { callId, isMuted, isSpeakerOn, remoteParticipant } = useCallState();
  const webrtc = useWebRTC(socket);
  useCallTimer();

  /** Start an outgoing audio call to receiverInfo = { id, name, avatar } */
  const initiateCall = useCallback(
    async (receiverInfo, callerInfo) => {
      const newCallId = generateCallId();
      dispatch(
        callInitiated({
          callId: newCallId,
          callType: CALL_TYPE.AUDIO,
          direction: 'outgoing',
          callerInfo,
          receiverInfo,
        }),
      );
      await webrtc.initLocalStream(CALL_TYPE.AUDIO);
      callSocket.initiateCall({
        callId: newCallId,
        callType: CALL_TYPE.AUDIO,
        receiverId: receiverInfo.id,
      });
      await webrtc.startCall();
      router.push('/call/audio');
    },
    [dispatch, router, webrtc],
  );

  /** Receiver answers the call */
  const answerCall = useCallback(async () => {
    dispatch(callAccepted());
    await webrtc.initLocalStream(CALL_TYPE.AUDIO);
    callSocket.acceptCall({ callId });
  }, [dispatch, callId, webrtc]);

  /** Receiver declines before answering */
  const declineCall = useCallback(() => {
    callSocket.declineCall({ callId });
    dispatch(callDeclined());
    setTimeout(() => dispatch(callReset()), 2000);
  }, [dispatch, callId]);

  /** Either side hangs up */
  const endCall = useCallback(() => {
    callSocket.endCall({ callId });
    dispatch(callEnded());
    router.push('/chat');
  }, [dispatch, callId, router]);

  const handleToggleMute = useCallback(() => {
    dispatch(toggleMute());
    webrtc.toggleMuteTrack(!isMuted);
  }, [dispatch, isMuted, webrtc]);

  const handleToggleSpeaker = useCallback(() => {
    dispatch(toggleSpeaker());
    // Physical speaker routing is handled by the audio output device API (future)
  }, [dispatch]);

  return {
    remoteParticipant,
    localStream: webrtc.localStream,
    remoteStream: webrtc.remoteStream,
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute: handleToggleMute,
    toggleSpeaker: handleToggleSpeaker,
  };
}
