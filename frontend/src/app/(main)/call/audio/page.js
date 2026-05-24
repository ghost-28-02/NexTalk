'use client';

import { AudioCallScreen } from '@/features/call/components/audio';
import { useAudioCall } from '@/features/call/hooks';

/**
 * Route: /call/audio
 * Thin shell — all logic lives in useAudioCall and AudioCallScreen.
 * Pass your socket instance here once SocketProvider is wired up:
 *   const { socket } = useSocket();
 *   const call = useAudioCall(socket);
 */
export default function AudioCallPage() {
  // TODO: replace null with socket from useSocket() once SocketProvider is ready
  const { answerCall, declineCall, endCall, toggleMute, toggleSpeaker } = useAudioCall(null);

  return (
    <AudioCallScreen
      onAnswer={answerCall}
      onDecline={declineCall}
      onEnd={endCall}
      onToggleMute={toggleMute}
      onToggleSpeaker={toggleSpeaker}
    />
  );
}
