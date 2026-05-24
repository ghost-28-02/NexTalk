'use client';

import { VideoCallScreen } from '@/features/call/components/video';
import { useVideoCall } from '@/features/call/hooks';

/**
 * Route: /call/video
 * Thin shell — all logic lives in useVideoCall and VideoCallScreen.
 * Pass your socket instance here once SocketProvider is wired up:
 *   const { socket } = useSocket();
 *   const call = useVideoCall(socket);
 */
export default function VideoCallPage() {
  // TODO: replace null with socket from useSocket() once SocketProvider is ready
  const {
    localStream,
    remoteStream,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  } = useVideoCall(null);

  return (
    <VideoCallScreen
      localStream={localStream}
      remoteStream={remoteStream}
      onAnswer={answerCall}
      onDecline={declineCall}
      onEnd={endCall}
      onToggleMute={toggleMute}
      onToggleVideo={toggleVideo}
      onToggleScreenShare={toggleScreenShare}
    />
  );
}
