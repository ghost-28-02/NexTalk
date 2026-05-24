import { Mic, MicOff, Volume2, VolumeX, PhoneOff } from 'lucide-react';
import { ControlButton } from './ControlButton';

/**
 * Controls bar for an active audio call.
 * All state is passed in — this component is purely presentational.
 */
export function AudioControls({ isMuted, isSpeakerOn, onToggleMute, onToggleSpeaker, onEndCall }) {
  return (
    <div className="flex items-center justify-center gap-8">
      <ControlButton
        icon={isMuted ? MicOff : Mic}
        label={isMuted ? 'Unmute' : 'Mute'}
        isActive={isMuted}
        onClick={onToggleMute}
      />
      <ControlButton
        icon={isSpeakerOn ? Volume2 : VolumeX}
        label="Speaker"
        isActive={isSpeakerOn}
        onClick={onToggleSpeaker}
      />
      <ControlButton
        icon={PhoneOff}
        label="End"
        isDestructive
        onClick={onEndCall}
      />
    </div>
  );
}
