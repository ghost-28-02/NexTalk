import { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, PhoneOff } from 'lucide-react';
import Link from 'next/link';
import { ControlButton } from './ControlButton';

/**
 * Controls bar for an active video call.
 * Rendered over the dark video feed, so all non-destructive buttons use dark=true.
 */
export function VideoControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <ControlButton
        icon={isMuted ? MicOff : Mic}
        isActive={isMuted}
        onClick={onToggleMute}
        dark
      />
      <ControlButton
        icon={isVideoOff ? VideoOff : Video}
        isActive={isVideoOff}
        onClick={onToggleVideo}
        dark
      />
      <ControlButton
        icon={Monitor}
        label={isScreenSharing ? 'Sharing' : 'Share'}
        isActive={isScreenSharing}
        onClick={onToggleScreenShare}
        dark
      />
      <Link href="/chat">
        <ControlButton icon={MessageSquare} dark />
      </Link>
      <ControlButton icon={PhoneOff} isDestructive onClick={onEndCall} />
    </div>
  );
}
