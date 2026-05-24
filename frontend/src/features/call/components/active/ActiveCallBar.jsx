'use client';

import { useSelector } from 'react-redux';
import { Maximize2, PhoneOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/common';
import { CallTimer } from '../common/CallTimer';
import {
  selectIsCallActive,
  selectRemoteParticipant,
  selectCallType,
} from '../../store/callSelectors';

/**
 * Sticky banner shown at the top of any page while a call is active.
 * Lets users navigate away from /call/* without ending the call.
 * Render once in your main layout.
 */
export function ActiveCallBar({ onEnd }) {
  const isActive = useSelector(selectIsCallActive);
  const remoteParticipant = useSelector(selectRemoteParticipant);
  const callType = useSelector(selectCallType);

  if (!isActive) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-green-600 text-white px-4 py-2.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
          <UserAvatar user={remoteParticipant} size="sm" showStatus={false} />
        </div>
        <div>
          <p className="font-medium text-sm leading-tight">{remoteParticipant?.name}</p>
          <p className="text-xs text-white/80 tabular-nums">
            <CallTimer />
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Link href={`/call/${callType}`}>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8 rounded-full"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-red-500/60 h-8 w-8 rounded-full"
          onClick={onEnd}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
