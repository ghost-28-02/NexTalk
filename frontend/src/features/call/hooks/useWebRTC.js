'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { WebRTCManager } from '../services/webrtc';
import { callSocket } from '../services/callSocket';
import { callConnected, callReconnecting, setScreenSharing } from '../store/callSlice';
import { selectCallId, selectCallState } from '../store/callSelectors';
import { CALL_STATE, SOCKET_EVENTS } from '../constants/callConstants';

/**
 * Manages one WebRTCManager per call.
 * Wires up ICE / SDP relay via callSocket and maps RTCPeerConnection
 * state changes into Redux dispatches.
 *
 * @param {import('socket.io-client').Socket | null} socket
 */
export function useWebRTC(socket) {
  const dispatch = useDispatch();
  const callId = useSelector(selectCallId);
  const callState = useSelector(selectCallState);

  const managerRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const getManager = useCallback(() => {
    if (!managerRef.current) managerRef.current = new WebRTCManager();
    return managerRef.current;
  }, []);

  // ─── Signaling event listeners from the remote peer ─────────────────────
  useEffect(() => {
    if (!socket || !callId) return;

    const handleOffer = async ({ sdp }) => {
      const manager = getManager();
      manager.createPeerConnection();
      await manager.setRemoteDescription(sdp);
      const answer = await manager.createAnswer();
      callSocket.sendAnswer({ callId, sdp: answer });
    };

    const handleAnswer = async ({ sdp }) => {
      await getManager().setRemoteDescription(sdp);
    };

    const handleIceCandidate = async ({ candidate }) => {
      await getManager().addIceCandidate(candidate);
    };

    socket.on(SOCKET_EVENTS.OFFER, handleOffer);
    socket.on(SOCKET_EVENTS.ANSWER, handleAnswer);
    socket.on(SOCKET_EVENTS.ICE_CANDIDATE, handleIceCandidate);

    return () => {
      socket.off(SOCKET_EVENTS.OFFER, handleOffer);
      socket.off(SOCKET_EVENTS.ANSWER, handleAnswer);
      socket.off(SOCKET_EVENTS.ICE_CANDIDATE, handleIceCandidate);
    };
  }, [socket, callId, getManager]);

  // ─── Tear down when the call ends ────────────────────────────────────────
  useEffect(() => {
    if (callState === CALL_STATE.IDLE || callState === CALL_STATE.ENDED) {
      managerRef.current?.destroy();
      managerRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
    }
  }, [callState]);

  // ─── Public API ──────────────────────────────────────────────────────────

  const initLocalStream = useCallback(async (callType) => {
    const manager = getManager();
    const stream = await manager.getUserMedia(callType);
    setLocalStream(stream);
    return stream;
  }, [getManager]);

  /** Called by the initiator (outgoing call) after getUserMedia */
  const startCall = useCallback(async () => {
    const manager = getManager();
    manager.createPeerConnection();

    manager.onIceCandidate = (candidate) => {
      callSocket.sendIceCandidate({ callId, candidate });
    };
    manager.onRemoteStream = (stream) => {
      setRemoteStream(stream);
      dispatch(callConnected());
    };
    manager.onConnectionStateChange = (state) => {
      if (state === 'disconnected' || state === 'failed') {
        dispatch(callReconnecting());
      } else if (state === 'connected') {
        dispatch(callConnected());
      }
    };

    const offer = await manager.createOffer();
    callSocket.sendOffer({ callId, sdp: offer });
  }, [callId, dispatch, getManager]);

  /** Mutes/unmutes the local audio track and notifies the peer */
  const toggleMuteTrack = useCallback((muted) => {
    getManager().toggleAudio(muted);
    callSocket.notifyMuteState({ callId, muted });
  }, [callId, getManager]);

  /** Enables/disables the local video track and notifies the peer */
  const toggleVideoTrack = useCallback((off) => {
    getManager().toggleVideo(off);
    callSocket.notifyVideoState({ callId, videoOff: off });
  }, [callId, getManager]);

  const startScreenShare = useCallback(async () => {
    await getManager().startScreenShare();
    dispatch(setScreenSharing(true));
  }, [dispatch, getManager]);

  const stopScreenShare = useCallback(async () => {
    await getManager().stopScreenShare();
    dispatch(setScreenSharing(false));
  }, [dispatch, getManager]);

  return {
    localStream,
    remoteStream,
    initLocalStream,
    startCall,
    toggleMuteTrack,
    toggleVideoTrack,
    startScreenShare,
    stopScreenShare,
  };
}
