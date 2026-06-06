'use client';

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  X, Bell, BellOff, Pin, PinOff, Search, Image as ImageIcon,
  FileText, ChevronRight, ChevronDown, UserPlus, LogOut, Trash2,
  Mail, Globe, MessageSquare, Shield, Film, Music,
} from 'lucide-react';
import { selectChatMessages, activeChatSet, chatRemoved, chatPinToggled, chatMuteToggled } from '../store/chatSlice';
import { useLeaveChatMutation, useTogglePinMutation, useToggleMuteMutation, useDeleteChatMutation } from '../services/chatApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionHeader(label) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-2">
      {label}
    </p>
  );
}

// ─── Media grid ───────────────────────────────────────────────────────────────

function MediaGrid({ messages }) {
  const [showAll, setShowAll] = useState(false);

  const mediaItems = messages.filter(
    (m) => (m.type === 'image' || m.type === 'video') && m.media?.url && !m.isDeleted,
  );

  if (mediaItems.length === 0) {
    return <p className="text-xs text-muted-foreground px-1">No media shared yet.</p>;
  }

  const displayed = showAll ? mediaItems : mediaItems.slice(0, 6);

  return (
    <div>
      <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
        {displayed.map((m) => (
          <div key={m.id} className="relative aspect-square bg-muted overflow-hidden rounded-lg">
            {m.type === 'image' ? (
              <img
                src={m.media.url}
                alt=""
                className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer"
                onClick={() => window.open(m.media.url, '_blank')}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => window.open(m.media.url, '_blank')}
              >
                <Film className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>
      {mediaItems.length > 6 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1 text-xs text-muted-foreground"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show less' : `View all ${mediaItems.length} items`}
          <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', showAll && 'rotate-180')} />
        </Button>
      )}
    </div>
  );
}

// ─── Files list ───────────────────────────────────────────────────────────────

function FilesList({ messages }) {
  const [showAll, setShowAll] = useState(false);

  const fileItems = messages.filter(
    (m) => m.type === 'file' && m.media?.url && !m.isDeleted,
  );

  if (fileItems.length === 0) {
    return <p className="text-xs text-muted-foreground px-1">No files shared yet.</p>;
  }

  const displayed = showAll ? fileItems : fileItems.slice(0, 4);

  return (
    <div className="space-y-1">
      {displayed.map((m) => {
        const ext  = m.media.name?.split('.').pop()?.toUpperCase() || 'FILE';
        const size = m.media.size
          ? m.media.size < 1024 * 1024
            ? `${(m.media.size / 1024).toFixed(0)} KB`
            : `${(m.media.size / (1024 * 1024)).toFixed(1)} MB`
          : '';
        return (
          <a
            key={m.id}
            href={m.media.url}
            download={m.media.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/60 transition-colors group"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{m.media.name || 'File'}</p>
              <p className="text-[10px] text-muted-foreground">{ext}{size ? ` · ${size}` : ''}</p>
            </div>
          </a>
        );
      })}
      {fileItems.length > 4 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show less' : `View all ${fileItems.length} files`}
          <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', showAll && 'rotate-180')} />
        </Button>
      )}
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({ member, currentUserId, isAdmin }) {
  const isMe = member.id?.toString() === currentUserId?.toString();
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <UserAvatar user={member} size="sm" showStatus />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {member.name || member.displayName || member.username}
          {isMe && <span className="text-muted-foreground font-normal"> (You)</span>}
        </p>
        {member.username && (
          <p className="text-[10px] text-muted-foreground">@{member.username}</p>
        )}
      </div>
      {isAdmin && (
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">Admin</Badge>
      )}
    </div>
  );
}

// ─── ChatInfoPanel ────────────────────────────────────────────────────────────

export function ChatInfoPanel({ chat, onClose }) {
  const router      = useRouter();
  const dispatch    = useDispatch();
  const currentUser = useSelector((s) => s.auth.user);
  const messages    = useSelector(selectChatMessages(chat?.id?.toString())) ?? [];

  const [showAllMembers, setShowAllMembers] = useState(false);
  const [leaveChat]   = useLeaveChatMutation();
  const [togglePin]   = useTogglePinMutation();
  const [toggleMute]  = useToggleMuteMutation();
  const [deleteChat]  = useDeleteChatMutation();

  const isGroupChat      = chat?.type === 'group';
  const otherParticipant = !isGroupChat
    ? (chat?.participants ?? []).find((p) => p.id?.toString() !== currentUser?.id?.toString())
    : null;

  const chatName     = chat?.name || 'Chat';
  const chatAvatar   = chat?.avatar;
  const participants = chat?.participants ?? [];
  const displayed    = showAllMembers ? participants : participants.slice(0, 5);

  const handlePin = async () => {
    try {
      const { data } = await togglePin(chat.id).unwrap();
      dispatch(chatPinToggled({ chatId: chat.id, isPinned: data?.isPinned ?? !chat.isPinned }));
      toast.success(chat.isPinned ? 'Chat unpinned' : 'Chat pinned');
    } catch {
      toast.error('Failed to update pin');
    }
  };

  const handleMute = async () => {
    try {
      const { data } = await toggleMute(chat.id).unwrap();
      dispatch(chatMuteToggled({ chatId: chat.id, isMuted: data?.isMuted ?? !chat.isMuted }));
      toast.success(chat.isMuted ? 'Notifications unmuted' : 'Notifications muted');
    } catch {
      toast.error('Failed to update mute');
    }
  };

  const handleLeave = async () => {
    try {
      await leaveChat(chat.id).unwrap();
      dispatch(chatRemoved(chat.id));
      onClose();
      router.push('/chat');
      toast.success('Left the group');
    } catch {
      toast.error('Failed to leave group');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteChat(chat.id).unwrap();
      dispatch(chatRemoved(chat.id));
      onClose();
      router.push('/chat');
      toast.success('Chat deleted');
    } catch {
      toast.error('Failed to delete chat');
    }
  };

  if (!chat) return null;

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
        <h3 className="font-semibold text-sm">
          {isGroupChat ? 'Group Info' : 'Contact Info'}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-5">

          {/* ── Profile ──────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center pt-2">
            {isGroupChat ? (
              <Avatar className="h-20 w-20 border-4 border-background shadow-md">
                <AvatarImage src={chatAvatar} alt={chatName} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {chatName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : otherParticipant ? (
              <UserAvatar user={otherParticipant} size="xl" showStatus />
            ) : null}

            <h2 className="text-lg font-bold mt-3">{chatName}</h2>

            {isGroupChat ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {participants.length} members
              </p>
            ) : otherParticipant ? (
              <div className="space-y-0.5 mt-1">
                {otherParticipant.username && (
                  <p className="text-xs text-muted-foreground">@{otherParticipant.username}</p>
                )}
                <p className={cn(
                  'text-xs font-medium',
                  otherParticipant.status === 'online' ? 'text-green-500' : 'text-muted-foreground',
                )}>
                  {otherParticipant.status === 'online' ? '● Online' : '○ Offline'}
                </p>
              </div>
            ) : null}

            {/* Bio */}
            {!isGroupChat && otherParticipant?.bio && (
              <p className="text-xs text-muted-foreground mt-2 max-w-[200px] leading-relaxed">
                {otherParticipant.bio}
              </p>
            )}
            {isGroupChat && chat.description && (
              <p className="text-xs text-muted-foreground mt-2 max-w-[200px] leading-relaxed">
                {chat.description}
              </p>
            )}
          </div>

          {/* ── Quick actions ─────────────────────────────────────────────── */}
          <div className="flex justify-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={handleMute}>
                {chat.isMuted
                  ? <BellOff className="h-4 w-4 text-muted-foreground" />
                  : <Bell className="h-4 w-4" />
                }
              </Button>
              <span className="text-[9px] text-muted-foreground">
                {chat.isMuted ? 'Unmute' : 'Mute'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={handlePin}>
                {chat.isPinned
                  ? <PinOff className="h-4 w-4 text-primary" />
                  : <Pin className="h-4 w-4" />
                }
              </Button>
              <span className="text-[9px] text-muted-foreground">
                {chat.isPinned ? 'Unpin' : 'Pin'}
              </span>
            </div>
          </div>

          <Separator />

          {/* ── Members (groups only) ─────────────────────────────────────── */}
          {isGroupChat && (
            <>
              {sectionHeader('Members')}
              <div className="space-y-0.5">
                {displayed.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    currentUserId={currentUser?.id}
                    isAdmin={member.role === 'admin'}
                  />
                ))}
                {participants.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs text-muted-foreground mt-1"
                    onClick={() => setShowAllMembers((v) => !v)}
                  >
                    {showAllMembers
                      ? 'Show less'
                      : `+${participants.length - 5} more members`
                    }
                    <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', showAllMembers && 'rotate-180')} />
                  </Button>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* ── Media ─────────────────────────────────────────────────────── */}
          {sectionHeader('Media')}
          <MediaGrid messages={messages} />

          <Separator />

          {/* ── Files ─────────────────────────────────────────────────────── */}
          {sectionHeader('Files')}
          <FilesList messages={messages} />

          <Separator />

          {/* ── Danger zone ───────────────────────────────────────────────── */}
          <div className="space-y-1 pb-2">
            {isGroupChat && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                onClick={handleLeave}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave Group
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isGroupChat ? 'Delete Group' : 'Delete Chat'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
