'use client';

import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/common';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pin, VolumeX } from 'lucide-react';

/** Format ISO → "h:mm AM/PM", falling back to empty string. */
function formatTime(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour:   'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * ChatListItem
 *
 * Receives a chat DTO from the backend (via chatSlice).
 * The DTO pre-computes `name` and `avatar`:
 *   - DMs:    name = other participant's displayName, avatar = their avatar URL
 *   - Groups: name = group name, avatar = group avatar URL
 *
 * Props:
 *   chat          — chat DTO object from chatSlice
 *   currentUserId — used to find the "other" participant for UserAvatar (DMs)
 *   isActive      — highlights this item when it's the open conversation
 *   onClick       — callback when the item is clicked
 */
export function ChatListItem({ chat, currentUserId, isActive, onClick }) {
  // For DMs, find the other participant to pass their online status to UserAvatar
  const otherParticipant =
    chat.type === 'direct'
      ? (chat.participants ?? []).find(
          (p) => p.id?.toString() !== currentUserId?.toString(),
        )
      : null;

  const isGroupChat = chat.type === 'group';
  const chatName    = chat.name || 'Unnamed';
  const chatAvatar  = chat.avatar;
  const lastMsg     = chat.lastMessage;

  const lastMsgPreview = lastMsg
    ? (lastMsg.type === 'image' ? '📷 Photo'
      : lastMsg.type === 'video' ? '🎥 Video'
      : lastMsg.type === 'audio' ? '🎵 Audio'
      : lastMsg.type === 'file'  ? '📎 File'
      : lastMsg.content ?? 'Message deleted')
    : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
        'hover:bg-accent/50 active:scale-[0.98] overflow-hidden',
        isActive && 'bg-accent/70 hover:bg-accent/70',
      )}
    >
      {/* Avatar — shrink-0 so it never gets squeezed */}
      <div className="shrink-0">
        {!isGroupChat && otherParticipant ? (
          <UserAvatar user={otherParticipant} size="md" />
        ) : (
          <Avatar className="h-10 w-10 border-2 border-background">
            <AvatarImage src={chatAvatar} alt={chatName} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
              {chatName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Content — min-w-0 is critical: allows flex child to shrink below content size */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1">
          <span className="font-medium text-sm truncate">{chatName}</span>
          {chat.isPinned && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
          {chat.isMuted  && <VolumeX className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground truncate w-full">
          {lastMsg
            ? `${lastMsg.senderId?.toString() === currentUserId?.toString() ? 'You: ' : ''}${lastMsgPreview}`
            : ''}
        </p>
      </div>

      {/* Right column — shrink-0 with explicit width so it never expands or collapses */}
      <div className="shrink-0 flex flex-col items-end gap-1 w-10">
        {lastMsg?.createdAt && (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatTime(lastMsg.createdAt)}
          </span>
        )}
        {chat.unreadCount > 0 && (
          <span className="h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
}
