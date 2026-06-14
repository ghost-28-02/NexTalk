'use client';

/**
 * CallHistoryList — WhatsApp-style call log.
 *
 * Data comes from the backend (callHistoryApi); each entry's `direction` and
 * `peer` are already resolved for the current user. Behaviour:
 *   - tapping a row opens that person's chat
 *   - the audio / video icons start a fresh call back
 *   - the trash icon (hover) deletes a single entry
 *
 * Missed & declined-incoming calls are shown in red, like WhatsApp.
 */

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Trash2, Loader2, PhoneCall,
} from 'lucide-react';
import {
  useGetCallHistoryQuery,
  useDeleteCallEntryMutation,
  useClearCallHistoryMutation,
} from '../services/callHistoryApi';
import { outgoingCallStarted, selectIsCallIdle } from '../store/callSlice';
import { activeChatSet } from '@/features/chat/store/chatSlice';

// ─── Formatting helpers ─────────────────────────────────────────────────────

function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now  = new Date();
  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday - 86_400_000);
  const startOfWeek      = new Date(startOfToday - 6 * 86_400_000);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (date >= startOfToday)     return time;
  if (date >= startOfYesterday) return `Yesterday, ${time}`;
  if (date >= startOfWeek)      return `${date.toLocaleDateString([], { weekday: 'short' })}, ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Direction/status → icon, colour, label
function describe(call) {
  const isMissedish =
    call.status === 'missed' ||
    (call.status === 'declined' && call.direction === 'incoming');

  if (isMissedish) {
    return {
      Icon: PhoneMissed,
      iconClass: 'text-destructive',
      nameClass: 'text-destructive',
      label: call.status === 'declined' ? 'Declined' : 'Missed',
    };
  }
  if (call.status === 'declined') {
    // outgoing call the other person declined
    return { Icon: PhoneOutgoing, iconClass: 'text-muted-foreground', nameClass: '', label: 'Declined' };
  }
  // answered
  return call.direction === 'outgoing'
    ? { Icon: PhoneOutgoing, iconClass: 'text-green-500', nameClass: '', label: 'Outgoing' }
    : { Icon: PhoneIncoming, iconClass: 'text-green-500', nameClass: '', label: 'Incoming' };
}

// ─── Row ────────────────────────────────────────────────────────────────────

function CallRow({ call, isCallIdle, onOpenChat, onCallBack, onDelete }) {
  const { Icon, iconClass, nameClass, label } = describe(call);
  const peer = call.peer ?? { name: 'Unknown' };
  const initials = (peer.name ?? '?').slice(0, 2).toUpperCase();
  const duration = formatDuration(call.duration);

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-colors">
      <button
        onClick={() => onOpenChat(call)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <Avatar className="h-11 w-11 shrink-0 border border-border">
          <AvatarImage src={peer.avatar ?? undefined} alt={peer.name} />
          <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className={cn('font-medium truncate', nameClass)}>{peer.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClass)} />
            <span>{label}</span>
            <span aria-hidden>·</span>
            <span>{formatWhen(call.createdAt)}</span>
            {duration && (<><span aria-hidden>·</span><span>{duration}</span></>)}
          </p>
        </div>
      </button>

      {/* Call type indicator + call-back actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          size="icon" variant="ghost"
          title="Audio call"
          disabled={!isCallIdle || !peer.id}
          onClick={() => onCallBack(call, 'audio')}
          className="h-9 w-9 text-muted-foreground hover:text-primary"
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          size="icon" variant="ghost"
          title="Video call"
          disabled={!isCallIdle || !peer.id}
          onClick={() => onCallBack(call, 'video')}
          className="h-9 w-9 text-muted-foreground hover:text-primary"
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button
          size="icon" variant="ghost"
          title="Delete"
          onClick={() => onDelete(call.id)}
          className="h-9 w-9 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── List ───────────────────────────────────────────────────────────────────

export function CallHistoryList() {
  const dispatch   = useDispatch();
  const router     = useRouter();
  const isCallIdle = useSelector(selectIsCallIdle);

  const [before, setBefore] = useState(undefined);
  const { data, isLoading, isFetching } = useGetCallHistoryQuery(
    before ? { before } : {},
    { refetchOnMountOrArgChange: true },
  );
  const [deleteEntry] = useDeleteCallEntryMutation();
  const [clearHistory, { isLoading: isClearing }] = useClearCallHistoryMutation();

  const calls      = data?.calls ?? [];
  const hasMore    = data?.hasMore ?? false;
  const nextCursor = data?.nextCursor ?? null;

  const openChat = (call) => {
    if (!call.chatId) return;
    dispatch(activeChatSet(call.chatId));
    router.push('/chat');
  };

  const callBack = (call, callType) => {
    if (!call.peer?.id || !isCallIdle) return;
    dispatch(outgoingCallStarted({
      callId:   crypto.randomUUID(),
      callType,
      chatId:   call.chatId ?? null,
      peer: {
        id:     call.peer.id,
        name:   call.peer.name,
        avatar: call.peer.avatar ?? null,
      },
    }));
    router.push(`/call/${callType}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Calls</h1>
        </div>
        {calls.length > 0 && (
          <Button
            variant="ghost" size="sm"
            disabled={isClearing}
            onClick={() => { clearHistory(); setBefore(undefined); }}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clear all'}
          </Button>
        )}
      </header>

      <ScrollArea className="flex-1">
        <div className="p-2 max-w-2xl mx-auto w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground gap-3">
              <PhoneCall className="h-12 w-12 opacity-40" />
              <div>
                <p className="font-medium text-foreground">No calls yet</p>
                <p className="text-sm">Your call history will appear here.</p>
              </div>
            </div>
          ) : (
            <>
              {calls.map((call) => (
                <CallRow
                  key={call.id}
                  call={call}
                  isCallIdle={isCallIdle}
                  onOpenChat={openChat}
                  onCallBack={callBack}
                  onDelete={deleteEntry}
                />
              ))}

              {hasMore && (
                <div className="flex justify-center py-3">
                  <Button
                    variant="ghost" size="sm"
                    disabled={isFetching}
                    onClick={() => setBefore(nextCursor)}
                  >
                    {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load older calls'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
