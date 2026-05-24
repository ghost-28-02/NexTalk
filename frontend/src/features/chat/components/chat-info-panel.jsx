'use client';

import Link from 'next/link';
import { useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/common';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  X,
  Bell,
  BellOff,
  Pin,
  Search,
  Image as ImageIcon,
  FileText,
  ChevronRight,
  UserPlus,
  LogOut,
  Trash2,
} from 'lucide-react';

/**
 * ChatInfoPanel
 *
 * Props:
 *   chat    — active chat DTO from chatSlice (name/avatar/participants pre-computed)
 *   onClose — callback to hide the panel
 *
 * currentUser is read from auth Redux state — no longer passed as a prop.
 * Media/files section shows empty state (real media fetching is a future feature).
 */
export function ChatInfoPanel({ chat, onClose }) {
  const currentUser = useSelector((s) => s.auth.user);

  const isGroupChat      = chat?.type === 'group';
  const otherParticipant = !isGroupChat
    ? (chat?.participants ?? []).find(
        (p) => p.id?.toString() !== currentUser?.id?.toString(),
      )
    : null;

  const chatName   = chat?.name || 'Chat';
  const chatAvatar = chat?.avatar;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full shrink-0 animate-slide-in-right">
      <div className="h-16 px-4 flex items-center justify-between border-b border-border shrink-0">
        <h3 className="font-semibold">Chat Info</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">

          {/* ── Profile header ──────────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center">
            {isGroupChat ? (
              <Avatar className="h-20 w-20 border-4 border-background">
                <AvatarImage src={chatAvatar} alt={chatName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                  {chatName?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : otherParticipant ? (
              <UserAvatar user={otherParticipant} size="xl" />
            ) : null}

            <h2 className="text-xl font-bold mt-4">{chatName}</h2>
            {isGroupChat ? (
              <p className="text-sm text-muted-foreground">
                {(chat?.participants ?? []).length} members
              </p>
            ) : (
              otherParticipant && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {otherParticipant.status === 'online' ? 'Online' : 'Offline'}
                  </p>
                </>
              )
            )}
          </div>

          {/* ── Quick actions ─────────────────────────────────────────────── */}
          <div className="flex justify-center gap-4">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl">
              {chat?.isMuted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl">
              <Pin className={cn('h-5 w-5', chat?.isPinned && 'text-primary')} />
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl">
              <Search className="h-5 w-5" />
            </Button>
          </div>

          <Separator />

          {/* ── Members (groups only) ─────────────────────────────────────── */}
          {isGroupChat && (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Members</h4>
                  <Button variant="ghost" size="sm" className="h-7 gap-1">
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {(chat?.participants ?? []).slice(0, 5).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <UserAvatar user={member} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.name}
                          {member.id?.toString() === currentUser?.id?.toString() && ' (You)'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(chat?.participants ?? []).length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-muted-foreground"
                    >
                      View all {(chat?.participants ?? []).length} members
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* ── Media placeholder ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                Media
              </h4>
              <Link href="/media">
                <Button variant="ghost" size="sm" className="h-7">
                  See all
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">No media shared yet.</p>
          </div>

          {/* ── Files placeholder ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Files
              </h4>
              <Link href="/media">
                <Button variant="ghost" size="sm" className="h-7">
                  See all
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">No files shared yet.</p>
          </div>

          <Separator />

          {/* ── Danger zone ───────────────────────────────────────────────── */}
          <div className="space-y-2">
            {isGroupChat && (
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave Group
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Chat
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
