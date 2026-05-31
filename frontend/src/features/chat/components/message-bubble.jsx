'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Download, FileText, Film, Music, Phone, Video, X } from 'lucide-react';
import { UserAvatar } from '@/components/common';

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function ImageLightbox({ src, alt, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={onClose}>
        <X className="h-7 w-7" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Media renderers ──────────────────────────────────────────────────────────

function ImageBubble({ media }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <div className="overflow-hidden rounded-xl cursor-pointer max-w-[260px]" onClick={() => setLightbox(true)}>
        <img
          src={media.url}
          alt={media.name || 'Image'}
          className="w-full object-cover rounded-xl hover:opacity-90 transition-opacity"
          style={{ maxHeight: 300 }}
        />
      </div>
      {lightbox && <ImageLightbox src={media.url} alt={media.name || 'Image'} onClose={() => setLightbox(false)} />}
    </>
  );
}

function VideoBubble({ media }) {
  return (
    <div className="rounded-xl overflow-hidden max-w-[280px]">
      <video src={media.url} controls className="w-full rounded-xl" style={{ maxHeight: 260 }} preload="metadata" />
      {media.name && <p className="text-[11px] text-muted-foreground mt-1 px-1 truncate">{media.name}</p>}
    </div>
  );
}

function AudioBubble({ media, isOwn }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2 min-w-[220px]', isOwn ? 'bg-primary/80' : 'bg-muted/60')}>
      <Music className="h-5 w-5 shrink-0 opacity-70" />
      <audio src={media.url} controls className="h-8 flex-1" preload="metadata" />
    </div>
  );
}

function FileBubble({ media, isOwn }) {
  const ext = media.name?.split('.').pop()?.toUpperCase() || 'FILE';
  return (
    <a
      href={media.url}
      download={media.name}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 min-w-[200px] max-w-[260px] transition-opacity hover:opacity-80',
        isOwn ? 'bg-primary/80 text-primary-foreground' : 'bg-muted/60 text-foreground',
      )}
    >
      <div className={cn(
        'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
        isOwn ? 'bg-white/20' : 'bg-primary/15 text-primary',
      )}>
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{media.name || 'File'}</p>
        <p className={cn('text-[11px]', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {ext}{media.size ? ` · ${formatBytes(media.size)}` : ''}
        </p>
      </div>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}

function CallBubble({ message, isOwn }) {
  const isVideo = message.content?.toLowerCase().includes('video');
  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 min-w-[180px]', isOwn ? 'bg-primary/80 text-primary-foreground' : 'bg-muted/60')}>
      {isVideo ? <Video className="h-5 w-5 shrink-0 opacity-70" /> : <Phone className="h-5 w-5 shrink-0 opacity-70" />}
      <p className="text-sm font-medium">{message.content || 'Call'}</p>
    </div>
  );
}

// ─── Content router ───────────────────────────────────────────────────────────

function MessageContent({ message, isOwn }) {
  const { type, media, content, isDeleted } = message;

  if (isDeleted) {
    return <span className="italic text-muted-foreground text-sm">This message was deleted</span>;
  }

  if (type === 'image' && media?.url) {
    return (
      <>
        <ImageBubble media={media} isOwn={isOwn} />
        {content && <p className="text-sm mt-1.5 whitespace-pre-wrap">{content}</p>}
      </>
    );
  }

  if (type === 'video' && media?.url) {
    return (
      <>
        <VideoBubble media={media} isOwn={isOwn} />
        {content && <p className="text-sm mt-1.5 whitespace-pre-wrap">{content}</p>}
      </>
    );
  }

  if (type === 'audio' && media?.url) {
    return <AudioBubble media={media} isOwn={isOwn} />;
  }

  if (type === 'file' && media?.url) {
    return (
      <>
        <FileBubble media={media} isOwn={isOwn} />
        {content && <p className="text-sm mt-1.5 whitespace-pre-wrap">{content}</p>}
      </>
    );
  }

  if (type === 'call') {
    return <CallBubble message={message} isOwn={isOwn} />;
  }

  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>;
}

// ─── Status tick ──────────────────────────────────────────────────────────────

function StatusTick({ status }) {
  if (status === 'sending') return <Check className="h-3 w-3 opacity-40" />;
  if (status === 'failed')  return <span className="text-destructive text-[10px] font-bold">!</span>;
  if (status === 'sent')    return <Check className="h-3 w-3" />;
  return <CheckCheck className={cn('h-3 w-3', status === 'read' && 'text-primary')} />;
}

const NAKED_TYPES = new Set(['image', 'video', 'audio', 'file']);

// ─── MessageBubble ────────────────────────────────────────────────────────────

export function MessageBubble({ message, currentUserId, showAvatar = false, isGroupChat = false }) {
  const isOwn  = message.senderId?.toString() === currentUserId?.toString();
  const sender = message.sender;
  const type   = message.type || 'text';

  // Media messages render without a colored bubble wrapper
  const naked = NAKED_TYPES.has(type) && !message.isDeleted;

  return (
    <div className={cn('flex gap-2 animate-fade-in', isOwn ? 'justify-end' : 'justify-start')}>
      {!isOwn && showAvatar && sender && <UserAvatar user={sender} size="sm" showStatus={false} />}
      {!isOwn && !showAvatar && <div className="w-8" />}

      <div className={cn('max-w-[70%] flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
        {isGroupChat && !isOwn && sender && (
          <span className="text-xs text-primary font-medium px-1">{sender.name}</span>
        )}

        {naked ? (
          <div className={cn(message._isOptimistic && 'opacity-60')}>
            <MessageContent message={message} isOwn={isOwn} />
          </div>
        ) : (
          <div className={cn(
            'px-4 py-2.5 rounded-2xl',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border border-border rounded-bl-md',
            message._isOptimistic && 'opacity-75',
          )}>
            <MessageContent message={message} isOwn={isOwn} />
          </div>
        )}

        <div className={cn('flex items-center gap-1.5 px-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</span>
          {isOwn && <span className="text-muted-foreground"><StatusTick status={message.status} /></span>}
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
            <span key={delay} className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </div>
      </div>
      {userName && <span className="text-xs text-muted-foreground">{userName} is typing...</span>}
    </div>
  );
}
