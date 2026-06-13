'use client';

/**
 * CallScreen — the in-call UI, shared by /call/audio and /call/video.
 *
 * All WebRTC/signaling logic lives in useWebRTC; this component only binds
 * MediaStreams to <video>/<audio> elements and renders controls.
 *
 * Layout:
 *   video — remote fills the screen, local is a draggable-style PiP corner tile
 *   audio — centered avatar + status text (remote audio plays via hidden <audio>)
 */

import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
} from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useBindStream(stream) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return ref;
}

function CallTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return undefined;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return null;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return <span className="tabular-nums">{mm}:{ss}</span>;
}

const STATUS_TEXT = {
  outgoing:   'Ringing…',
  connecting: 'Connecting…',
};

const END_REASON_TEXT = {
  hangup:            'Call ended',
  rejected:          'Call declined',
  busy:              'User is busy',
  offline:           'User is offline',
  cancelled:         'Call cancelled',
  failed:            'Connection failed',
  media_error:       'Could not access camera/microphone',
  peer_disconnected: 'User disconnected',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CallScreen() {
  const { call, localStream, remoteStream, hangUp, toggleMute, toggleCamera } = useWebRTC();
  const { status, callType, peer, isMuted, isCameraOff, startedAt, endReason } = call;

  const localVideoRef  = useBindStream(localStream);
  const remoteVideoRef = useBindStream(remoteStream);
  const remoteAudioRef = useBindStream(remoteStream);

  const isVideo  = callType === 'video';
  const isActive = status === 'active';

  if (status === 'idle') return null; // redirecting (see useWebRTC)

  const statusText =
    status === 'ended'
      ? (END_REASON_TEXT[endReason] ?? 'Call ended')
      : STATUS_TEXT[status];

  return (
    <div className="relative h-full w-full bg-zinc-950 text-white flex flex-col overflow-hidden">

      {/* ── Remote media ──────────────────────────────────────────────────── */}
      {isVideo ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // Audio call: remote sound only, no video element
        <audio ref={remoteAudioRef} autoPlay />
      )}

      {/* ── Avatar + status overlay (audio calls, or video before connect) ── */}
      {(!isVideo || !isActive) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/80">
          <div className="relative">
            {(status === 'outgoing' || status === 'connecting') && (
              <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
            )}
            <Avatar className="h-28 w-28 relative border-4 border-zinc-800">
              <AvatarImage src={peer?.avatar ?? undefined} alt={peer?.name} />
              <AvatarFallback className="bg-zinc-800 text-zinc-200 text-3xl font-semibold">
                {(peer?.name ?? '?').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="text-2xl font-semibold">{peer?.name}</h2>
          <p className="text-sm text-zinc-400">
            {isActive ? <CallTimer startedAt={startedAt} /> : statusText}
          </p>
        </div>
      )}

      {/* ── Local PiP preview (video calls) ──────────────────────────────── */}
      {isVideo && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted /* never monitor your own mic — feedback loop */
          className={cn(
            'absolute top-4 right-4 w-32 md:w-44 aspect-video object-cover rounded-xl',
            'border border-zinc-700 shadow-lg z-10 bg-zinc-900',
            isCameraOff && 'opacity-40',
          )}
        />
      )}

      {/* ── Top bar (video active: name + timer) ─────────────────────────── */}
      {isVideo && isActive && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-sm">
          <span className="font-medium">{peer?.name}</span>
          <span className="text-zinc-400 ml-2"><CallTimer startedAt={startedAt} /></span>
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      {status !== 'ended' && (
        <div className="absolute bottom-8 inset-x-0 z-10 flex items-center justify-center gap-4">
          <Button
            size="icon"
            onClick={toggleMute}
            className={cn(
              'h-14 w-14 rounded-full backdrop-blur-sm',
              isMuted
                ? 'bg-white text-zinc-900 hover:bg-zinc-200'
                : 'bg-white/15 hover:bg-white/25 text-white',
            )}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          {isVideo && (
            <Button
              size="icon"
              onClick={toggleCamera}
              className={cn(
                'h-14 w-14 rounded-full backdrop-blur-sm',
                isCameraOff
                  ? 'bg-white text-zinc-900 hover:bg-zinc-200'
                  : 'bg-white/15 hover:bg-white/25 text-white',
              )}
            >
              {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>
          )}

          <Button
            size="icon"
            onClick={hangUp}
            className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 text-white"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
