'use client';

/**
 * IncomingCallModal — global ringing UI.
 *
 * Rendered once in AppProviders (inside SocketProvider) so it appears over
 * ANY page. Visible only while callSlice.status === 'incoming'.
 *
 * Accept → flip to 'connecting' + navigate to the call page; the ACTUAL
 * `call:accept` emit happens in useWebRTC after media + listeners are
 * ready (see that file for the race this avoids).
 * Decline → emit `call:reject` + reset.
 */

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useSocket } from '@/features/socket';
import { CALL_EVENTS } from '@/features/socket/constants/socketEvents';
import { selectIncomingCall, callConnecting, callReset } from '../store/callSlice';

const RING_TIMEOUT_MS = 30000; // auto-dismiss unanswered calls after 30 s

export function IncomingCallModal() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const socket   = useSocket();
  const incoming = useSelector(selectIncomingCall);

  // Missed-call timeout — stop ringing forever if the user never answers
  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => {
      // Unanswered ring → logged as a MISSED call (not a decline).
      socket?.emit(CALL_EVENTS.REJECT, {
        callId:       incoming.callId,
        targetUserId: incoming.peer.id,
        reason:       'missed',
      });
      dispatch(callReset());
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [incoming, socket, dispatch]);

  if (!incoming) return null;

  const { callId, callType, peer } = incoming;
  const isVideo = callType === 'video';

  const handleAccept = () => {
    dispatch(callConnecting());
    router.push(`/call/${callType}`);
  };

  const handleDecline = () => {
    socket?.emit(CALL_EVENTS.REJECT, { callId, targetUserId: peer.id, reason: 'rejected' });
    dispatch(callReset());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-border bg-card p-8 shadow-2xl flex flex-col items-center gap-5">
        {/* Pulsing avatar */}
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          <Avatar className="h-24 w-24 relative border-4 border-background">
            <AvatarImage src={peer.avatar ?? undefined} alt={peer.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
              {(peer.name ?? '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-semibold">{peer.name}</h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
            {isVideo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            Incoming {isVideo ? 'video' : 'voice'} call…
          </p>
        </div>

        <div className="flex items-center gap-6 mt-2">
          <div className="flex flex-col items-center gap-1.5">
            <Button
              size="icon"
              onClick={handleDecline}
              className="h-14 w-14 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <span className="text-xs text-muted-foreground">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Button
              size="icon"
              onClick={handleAccept}
              className="h-14 w-14 rounded-full bg-success hover:bg-success/90 text-white bg-green-600 hover:bg-green-700"
            >
              {isVideo ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            </Button>
            <span className="text-xs text-muted-foreground">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
