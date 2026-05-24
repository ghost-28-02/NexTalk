'use client';

import { useSelector } from 'react-redux';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CallerInfo } from '../common/CallerInfo';
import { CallBackground } from '../common/CallBackground';
import { AudioControls } from '../controls/AudioControls';
import {
  selectCallState,
  selectCallType,
  selectRemoteParticipant,
  selectIsMuted,
  selectIsSpeakerOn,
} from '../../store/callSelectors';
import { CALL_STATE } from '../../constants/callConstants';

/**
 * Full audio call screen — handles ringing, connecting, and connected states.
 * All handlers passed in from useAudioCall; this component stays purely visual.
 */
export function AudioCallScreen({ onAnswer, onDecline, onEnd, onToggleMute, onToggleSpeaker }) {
  const callState = useSelector(selectCallState);
  const callType = useSelector(selectCallType);
  const remoteParticipant = useSelector(selectRemoteParticipant);
  const isMuted = useSelector(selectIsMuted);
  const isSpeakerOn = useSelector(selectIsSpeakerOn);

  const isIncoming = callState === CALL_STATE.RINGING;
  const isConnected = callState === CALL_STATE.CONNECTED;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/10 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <CallBackground />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full gap-8">
        <CallerInfo user={remoteParticipant} callState={callState} callType={callType} />

        {/* Audio waveform animation while connected */}
        {isConnected && (
          <div className="flex items-end justify-center gap-1 h-8">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-primary rounded-full animate-pulse"
                style={{
                  height: `${[16, 28, 20, 32, 14][i]}px`,
                  animationDelay: `${i * 0.12}s`,
                  animationDuration: '0.7s',
                }}
              />
            ))}
          </div>
        )}

        {/* Active call controls */}
        {isConnected && (
          <AudioControls
            isMuted={isMuted}
            isSpeakerOn={isSpeakerOn}
            onToggleMute={onToggleMute}
            onToggleSpeaker={onToggleSpeaker}
            onEndCall={onEnd}
          />
        )}

        {/* Incoming call: decline / answer */}
        {isIncoming && (
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
                <Phone className="h-7 w-7" />
              </Button>
              <span className="text-sm text-muted-foreground">Answer</span>
            </div>
          </div>
        )}

        {/* Outgoing / connecting: cancel only */}
        {!isIncoming && !isConnected && (
          <Button
            size="lg"
            variant="destructive"
            className="h-16 w-16 rounded-full"
            onClick={onEnd}
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        )}
      </div>
    </div>
  );
}
