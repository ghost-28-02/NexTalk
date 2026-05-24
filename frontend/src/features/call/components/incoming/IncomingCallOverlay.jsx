'use client';

import { useSelector } from 'react-redux';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RingingAnimation } from '../common/RingingAnimation';
import {
  selectIsIncomingCall,
  selectCallerInfo,
  selectCallType,
} from '../../store/callSelectors';

/**
 * Floating bottom-right overlay that appears on any page when an
 * incoming call arrives. Driven entirely by Redux — no props needed.
 * Render this once in your main layout, above everything else.
 */
export function IncomingCallOverlay({ onAnswer, onDecline }) {
  const isIncoming = useSelector(selectIsIncomingCall);
  const callerInfo = useSelector(selectCallerInfo);
  const callType = useSelector(selectCallType);

  if (!isIncoming || !callerInfo) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-background border border-border rounded-2xl shadow-2xl p-4 w-72 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-4">
        <RingingAnimation user={callerInfo} isRinging size="sm" className="h-12 w-12" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{callerInfo.name}</p>
          <p className="text-sm text-muted-foreground">
            {callType === 'video' ? 'Incoming video call' : 'Incoming audio call'}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <Button
          variant="destructive"
          className="flex-1 rounded-full"
          onClick={onDecline}
        >
          <PhoneOff className="h-4 w-4 mr-2" />
          Decline
        </Button>
        <Button
          className="flex-1 rounded-full bg-green-500 hover:bg-green-600 text-white"
          onClick={onAnswer}
        >
          {callType === 'video' ? (
            <Video className="h-4 w-4 mr-2" />
          ) : (
            <Phone className="h-4 w-4 mr-2" />
          )}
          Answer
        </Button>
      </div>
    </div>
  );
}
