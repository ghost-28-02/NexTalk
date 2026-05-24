import { PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CallerInfo } from '../common/CallerInfo';
import { CallBackground } from '../common/CallBackground';

/**
 * Full-screen "Calling…" state shown to the initiator while waiting
 * for the remote peer to accept.
 */
export function OutgoingCallScreen({ remoteParticipant, callState, callType, onCancel }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/10 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <CallBackground />
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full gap-12">
        <CallerInfo user={remoteParticipant} callState={callState} callType={callType} />
        <Button
          size="lg"
          variant="destructive"
          className="h-16 w-16 rounded-full"
          onClick={onCancel}
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
}
