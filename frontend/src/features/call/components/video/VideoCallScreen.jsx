'use client';

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Monitor, Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/common';
import { VideoTile } from './VideoTile';
import { VideoControls } from '../controls/VideoControls';
import { CallerInfo } from '../common/CallerInfo';
import { CallBackground } from '../common/CallBackground';
import { CallTimer } from '../common/CallTimer';
import {
  selectCallState,
  selectCallType,
  selectRemoteParticipant,
  selectIsMuted,
  selectIsVideoOff,
  selectIsScreenSharing,
  selectIsRemoteMuted,
  selectIsRemoteVideoOff,
} from '../../store/callSelectors';
import { CALL_STATE } from '../../constants/callConstants';

/**
 * Full video call screen — handles ringing + connected states.
 * localStream / remoteStream are MediaStream objects from useVideoCall.
 */
export function VideoCallScreen({
  localStream,
  remoteStream,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
}) {
  const [showControls, setShowControls] = useState(true);
  const callState = useSelector(selectCallState);
  const callType = useSelector(selectCallType);
  const remoteParticipant = useSelector(selectRemoteParticipant);
  const isMuted = useSelector(selectIsMuted);
  const isVideoOff = useSelector(selectIsVideoOff);
  const isScreenSharing = useSelector(selectIsScreenSharing);
  const isRemoteMuted = useSelector(selectIsRemoteMuted);
  const isRemoteVideoOff = useSelector(selectIsRemoteVideoOff);

  const isIncoming = callState === CALL_STATE.RINGING;
  const isConnected = callState === CALL_STATE.CONNECTED;

  // Auto-hide controls 3s after they appear
  useEffect(() => {
    if (!isConnected || !showControls) return;
    const t = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(t);
  }, [isConnected, showControls]);

  // ─── Incoming ring screen ──────────────────────────────────────────────
  if (isIncoming) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/10 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <CallBackground />
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full gap-8">
          <CallerInfo user={remoteParticipant} callState={callState} callType={callType} />
          <div className="flex items-center justify-center gap-10">
            <div className="flex flex-col items-center gap-2">
              <Button
                size="lg"
                variant="destructive"
                className="h-16 w-16 rounded-full"
                onClick={onDecline}
              >
                <PhoneOff className="h-7 w-7" />
              </Button>
              <span className="text-sm text-muted-foreground">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button
                size="lg"
                className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 text-white border-0"
                onClick={onAnswer}
              >
                <Video className="h-7 w-7" />
              </Button>
              <span className="text-sm text-muted-foreground">Answer</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Connecting / outgoing / reconnecting screens ─────────────────────
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/10 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <CallBackground />
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full gap-12">
          <CallerInfo user={remoteParticipant} callState={callState} callType={callType} />
          <Button size="lg" variant="destructive" className="h-16 w-16 rounded-full" onClick={onEnd}>
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── Active connected video call ──────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-black relative overflow-hidden select-none"
      onClick={() => setShowControls(true)}
    >
      {/* Remote video — full screen */}
      <VideoTile
        stream={remoteStream}
        user={remoteParticipant}
        isMuted={isRemoteMuted}
        isVideoOff={isRemoteVideoOff}
        className="absolute inset-0 w-full h-full rounded-none"
      />

      {/* Local video — picture-in-picture */}
      <div className="absolute bottom-28 right-4 w-32 h-44 sm:w-40 sm:h-56 z-10 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
        <VideoTile
          stream={localStream}
          user={null}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSelf
          className="w-full h-full rounded-none"
        />
      </div>

      {/* Top bar — caller info + screen-share indicator */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserAvatar user={remoteParticipant} size="sm" showStatus={false} />
            <div>
              <p className="text-white font-medium">{remoteParticipant?.name}</p>
              <p className="text-white/70 text-sm tabular-nums">
                <CallTimer />
              </p>
            </div>
          </div>
          {isScreenSharing && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/80 text-white text-xs font-medium">
              <Monitor className="h-3 w-3" />
              Sharing screen
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <VideoControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          onToggleMute={onToggleMute}
          onToggleVideo={onToggleVideo}
          onToggleScreenShare={onToggleScreenShare}
          onEndCall={onEnd}
        />
      </div>
    </div>
  );
}
