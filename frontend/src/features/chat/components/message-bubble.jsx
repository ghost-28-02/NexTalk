'use client';

import { cn } from '@/lib/utils';
import { Check, CheckCheck } from 'lucide-react';
import { UserAvatar } from '@/components/common';

/** Format ISO timestamp → "h:mm AM/PM" */
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
 * MessageBubble
 *
 * Props:
 *   message      — backend message DTO:
 *                  { id, senderId, sender: { id, name, avatar }, content,
 *                    status, isDeleted, createdAt, _isOptimistic }
 *   currentUserId — the authenticated user's id (used to determine "is own")
 *   showAvatar   — whether to show the sender avatar (false when consecutive)
 *   isGroupChat  — show sender name above the bubble in group chats
 */
export function MessageBubble({
  message,
  currentUserId,
  showAvatar  = false,
  isGroupChat = false,
}) {
  const isOwn   = message.senderId?.toString() === currentUserId?.toString();
  const sender  = message.sender;       // { id, name, avatar } from DTO
  const content = message.isDeleted
    ? <span className="italic text-muted-foreground">This message was deleted</span>
    : message.content;

  return (
    <div className={cn('flex gap-2 animate-fade-in', isOwn ? 'justify-end' : 'justify-start')}>
      {/* Avatar column — only shown for incoming messages */}
      {!isOwn && showAvatar && sender && (
        <UserAvatar user={sender} size="sm" showStatus={false} />
      )}
      {!isOwn && !showAvatar && <div className="w-8" />}

      <div className={cn('max-w-[70%] flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name in group chats */}
        {isGroupChat && !isOwn && sender && (
          <span className="text-xs text-primary font-medium px-1">{sender.name}</span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border border-border rounded-bl-md',
            message._isOptimistic && 'opacity-75',
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>

        {/* Timestamp + status */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-1',
            isOwn ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <span className="text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
          {isOwn && (
            <span
              className={cn(
                'text-muted-foreground',
                message.status === 'read' && 'text-primary',
              )}
            >
              {message.status === 'sending' ? (
                // Pending — single faded check
                <Check className="h-3 w-3 opacity-50" />
              ) : message.status === 'failed' ? (
                // Failed — red indicator
                <span className="text-destructive text-[10px]">!</span>
              ) : message.status === 'sent' ? (
                <Check className="h-3 w-3" />
              ) : (
                // delivered or read
                <CheckCheck className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator({ userName }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex items-center gap-1 bg-card border border-border rounded-2xl px-4 py-2.5">
        <div className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
      {userName && (
        <span className="text-xs text-muted-foreground">{userName} is typing...</span>
      )}
    </div>
  );
}
