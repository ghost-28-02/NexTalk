'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import { CHAT_FILTERS } from '@/constants';
import { ChatListItem } from './chat-list-item';
import { NewConversationModal } from './new-conversation-modal';
import { CreateGroupModal } from './create-group-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search, Plus, MessageSquarePlus, Star, Archive, Users, MessageSquare,
} from 'lucide-react';

// ─── Filter label map ─────────────────────────────────────────────────────────

const FILTER_LABELS = { all: 'All', unread: 'Unread', groups: 'Groups' };

// ─── ChatSidebar ──────────────────────────────────────────────────────────────

export function ChatSidebar({ chats, activeChatId, onChatSelect, isMobile, className }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter,      setFilter]      = useState('all');
  const [newChatOpen,  setNewChatOpen]  = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const currentUser = useSelector((s) => s.auth.user);

  // ── Filter + search ──────────────────────────────────────────────────────
  const filteredChats = (chats ?? []).filter((chat) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      chat.name?.toLowerCase().includes(q) ||
      (chat.participants ?? []).some((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q),
      );
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && chat.unreadCount > 0) ||
      (filter === 'groups' && chat.type === 'group');
    return matchesSearch && matchesFilter;
  });

  const pinnedChats  = filteredChats.filter((c) => c.isPinned);
  const regularChats = filteredChats.filter((c) => !c.isPinned);

  return (
    <div
      className={cn(
        'flex flex-col bg-sidebar border-r border-sidebar-border h-full',
        isMobile ? 'w-full' : 'min-w-0',
        className,
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Chats</h2>

          {/* "+" dropdown → New DM or New Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setNewChatOpen(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                New Conversation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
                <Users className="h-4 w-4 mr-2" />
                New Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-9 h-9 bg-muted/50 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {CHAT_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat list ────────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0 px-2 pb-2">
        {pinnedChats.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center gap-1.5 px-2 py-2">
              <Star className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Pinned
              </span>
            </div>
            {pinnedChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                currentUserId={currentUser?.id}
                isActive={chat.id?.toString() === activeChatId?.toString()}
                onClick={() => onChatSelect(chat.id?.toString())}
              />
            ))}
          </div>
        )}

        {regularChats.length > 0 && (
          <div>
            {pinnedChats.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-2">
                <Archive className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  All Chats
                </span>
              </div>
            )}
            {regularChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                currentUserId={currentUser?.id}
                isActive={chat.id?.toString() === activeChatId?.toString()}
                onClick={() => onChatSelect(chat.id?.toString())}
              />
            ))}
          </div>
        )}

        {filteredChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquarePlus className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No results' : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setNewChatOpen(true)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Start one
              </button>
            )}
          </div>
        )}
      </ScrollArea>

      <NewConversationModal open={newChatOpen} onOpenChange={setNewChatOpen} />
      <CreateGroupModal    open={newGroupOpen} onOpenChange={setNewGroupOpen} />
    </div>
  );
}
