'use client';

/**
 * useWebRTC — owns the full WebRTC lifecycle for the call page.
 *
 * Glues together: WebRTCManager (media + RTCPeerConnection),
 * Socket.IO (signaling relay), callSlice (state machine).
 *
 * Handshake choreography (no offer/page race — see backend call.handler.js):
 *
 *   CALLER (isCaller)                      CALLEE
 *   page mounts, getUserMedia              page mounts, getUserMedia
 *   emit INITIATE ──ack ok──► ringing…     (accepted modal → navigated here)
 *                                          emit ACCEPT   ◄─ listeners ready
 *   on ACCEPTED: createOffer
 *   emit OFFER ──────────────────────────► on OFFER: handleOffer
 *                              ◄────────── emit ANSWER
 *   on ANSWER: handleAnswer
 *   ICE candidates trickle both ways ◄───►
 *   pc.connectionState 'connected' → callSlice 'active'
 *
 * The callee emits ACCEPT from THIS hook (after media + listeners are
 * ready), not from the modal — the modal only flips state to 'connecting'
 * and navigates. This guarantees the caller's OFFER can never arrive
 * before our OFFER listener exists.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/features/socket';
import { CALL_EVENTS } from '@/features/socket/constants/socketEvents';
import { WebRTCManager } from '../services/webrtc';
import {
  selectCall,
  callConnecting,
  callConnected,
  callEnded,
  callReset,
  isMutedToggled,
  isCameraOffToggled,
} from '../store/callSlice';

const ENDED_SCREEN_MS = 1800; // how long the "Call ended" screen lingers

export function useWebRTC() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const socket   = useSocket();
  const call     = useSelector(selectCall);

  const { callId, callType, isCaller, peer, status } = call;

  const managerRef       = useRef(null);
  const endedRef         = useRef(false); // guards double-teardown
  const teardownTimerRef = useRef(null);  // deferred teardown (StrictMode-safe)
  const callRef          = useRef(call);
  useEffect(() => { callRef.current = call; }, [call]);

  // MediaStreams are not serializable → local React state, never Redux.
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // ── Teardown helper ─────────────────────────────────────────────────────────

  const finishCall = useCallback((reason, { notifyPeer } = {}) => {
    if (endedRef.current) return;
    endedRef.current = true;

    const { callId: id, peer: p } = callRef.current;
    if (notifyPeer && socket && id && p?.id) {
      socket.emit(CALL_EVENTS.END, { callId: id, targetUserId: p.id, reason });
    }

    managerRef.current?.destroy();
    managerRef.current = null;
    dispatch(callEnded({ reason }));

    // Linger on the "ended" screen, then reset + leave the page
    setTimeout(() => {
      dispatch(callReset());
      router.replace('/chat');
    }, ENDED_SCREEN_MS);
  }, [socket, dispatch, router]);

  // ── Main lifecycle effect ───────────────────────────────────────────────────

  useEffect(() => {
    // Direct navigation to /call/* without a call in flight → bounce home
    if (status === 'idle' || status === 'ended') {
      if (status === 'idle') router.replace('/chat');
      return undefined;
    }
    if (!socket) return undefined;

    // StrictMode (React 19, dev) runs effects mount→unmount→mount. The unmount
    // schedules a DEFERRED teardown (see cleanup below); if we're remounting we
    // cancel it here so the throwaway probe never ends the call or wipes state.
    if (teardownTimerRef.current) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    // Create the peer connection once and REUSE it across a StrictMode remount —
    // recreating it (or destroying + recreating) is what dropped the handshake.
    let manager = managerRef.current;
    const freshManager = !manager;
    if (freshManager) {
      manager = new WebRTCManager({
        onLocalStream:  setLocalStream,
        onRemoteStream: setRemoteStream,
        onIceCandidate: (candidate) => {
          const { callId: id, peer: p } = callRef.current;
          socket.emit(CALL_EVENTS.ICE_CANDIDATE, { callId: id, targetUserId: p.id, candidate });
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') dispatch(callConnected());
          if (state === 'failed')    finishCall('failed', { notifyPeer: true });
          // 'disconnected' often self-heals (ICE restarts) — peer death is
          // covered by the server's ENDED(peer_disconnected) anyway.
        },
      });
      managerRef.current = manager;
    }

    // ── Inbound signaling ─────────────────────────────────────────────────────
    // Registered on EVERY setup (cleanup removes them) so listeners survive the
    // StrictMode remount even though the manager is reused. callId/peer are read
    // from callRef so a re-run can never capture a stale value.

    const guard = (fn) => (payload = {}) => {
      if (payload.callId !== callRef.current.callId) return; // stale call
      fn(payload);
    };

    const onAccepted = guard(async () => {
      dispatch(callConnecting());
      const offer = await manager.createOffer();
      const { callId: id, peer: p } = callRef.current;
      socket.emit(CALL_EVENTS.OFFER, { callId: id, targetUserId: p.id, sdp: offer });
    });

    const onOffer = guard(async ({ sdp }) => {
      const answer = await manager.handleOffer(sdp);
      const { callId: id, peer: p } = callRef.current;
      socket.emit(CALL_EVENTS.ANSWER, { callId: id, targetUserId: p.id, sdp: answer });
    });

    const onAnswer = guard(async ({ sdp }) => {
      await manager.handleAnswer(sdp);
    });

    const onIceCandidate = guard(({ candidate }) => {
      manager.addRemoteIceCandidate(candidate);
    });

    const onRejected = guard(({ reason }) => {
      finishCall(reason === 'busy' ? 'busy' : 'rejected');
    });

    const onEnded = guard(({ reason }) => {
      finishCall(reason || 'hangup');
    });

    socket.on(CALL_EVENTS.ACCEPTED,      onAccepted);
    socket.on(CALL_EVENTS.OFFER,         onOffer);
    socket.on(CALL_EVENTS.ANSWER,        onAnswer);
    socket.on(CALL_EVENTS.ICE_CANDIDATE, onIceCandidate);
    socket.on(CALL_EVENTS.REJECTED,      onRejected);
    socket.on(CALL_EVENTS.ENDED,         onEnded);

    // ── Kick off: media first, then signal readiness ──────────────────────────
    // Only for a freshly-created manager — a StrictMode remount reuses the
    // existing one and must NOT re-acquire media or re-emit INITIATE/ACCEPT.

    if (freshManager) {
      (async () => {
        try {
          await manager.initLocalMedia(callType);
        } catch {
          // Permission denied / no device
          finishCall('media_error', { notifyPeer: !isCaller });
          return;
        }

        const { callId: id, peer: p, chatId } = callRef.current;
        if (isCaller) {
          // Listeners are registered → safe to start ringing
          socket.emit(
            CALL_EVENTS.INITIATE,
            { callId: id, targetUserId: p.id, callType, chatId },
            (res) => {
              if (!res?.ok) finishCall(res?.reason || 'failed');
            },
          );
        } else {
          // Media + listeners ready → tell the caller to send the offer
          dispatch(callConnecting());
          socket.emit(CALL_EVENTS.ACCEPT, { callId: id, targetUserId: p.id });
        }
      })();
    }

    // ── Cleanup (page unmount / back button) ──────────────────────────────────

    return () => {
      socket.off(CALL_EVENTS.ACCEPTED,      onAccepted);
      socket.off(CALL_EVENTS.OFFER,         onOffer);
      socket.off(CALL_EVENTS.ANSWER,        onAnswer);
      socket.off(CALL_EVENTS.ICE_CANDIDATE, onIceCandidate);
      socket.off(CALL_EVENTS.REJECTED,      onRejected);
      socket.off(CALL_EVENTS.ENDED,         onEnded);

      // DEFER the destructive teardown. A real unmount (navigate away / back
      // button) lets this fire and treats it as a hangup. A StrictMode probe
      // remounts synchronously and cancels it above — so the call survives.
      teardownTimerRef.current = setTimeout(() => {
        teardownTimerRef.current = null;
        if (endedRef.current) return; // already torn down by finishCall/hangUp
        endedRef.current = true;
        const { callId: id, peer: p } = callRef.current;
        if (id && p?.id) socket.emit(CALL_EVENTS.END, { callId: id, targetUserId: p.id, reason: 'hangup' });
        managerRef.current?.destroy();
        managerRef.current = null;
        dispatch(callReset());
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]); // single registration — everything else flows through refs

  // ── Controls ────────────────────────────────────────────────────────────────

  const hangUp = useCallback(() => {
    finishCall('hangup', { notifyPeer: true });
  }, [finishCall]);

  const toggleMute = useCallback(() => {
    managerRef.current?.toggleAudio();
    dispatch(isMutedToggled());
  }, [dispatch]);

  const toggleCamera = useCallback(() => {
    managerRef.current?.toggleVideo();
    dispatch(isCameraOffToggled());
  }, [dispatch]);

  return {
    call,          // full callSlice state (status, peer, callType, isMuted, …)
    localStream,
    remoteStream,
    hangUp,
    toggleMute,
    toggleCamera,
  };
}
