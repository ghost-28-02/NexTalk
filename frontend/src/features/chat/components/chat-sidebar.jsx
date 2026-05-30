'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useSelector } from 'react-redux';
import { selectNotificationUnreadCount } from '@/features/notification/store/notificationSlice';
import { cn } from '@/lib/utils';
import { CHAT_FILTERS } from '@/constants';
import { ChatListItem } from './chat-list-item';
import { NewConversationModal } from './new-conversation-modal';
import { Logo, UserAvatar } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLogoutMutation } from '@/features/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  Settings,
  Users,
  Bell,
  Moon,
  Sun,
  LogOut,
  MessageSquarePlus,
  Archive,
  Star,
} from 'lucide-react';

export function ChatSidebar({ chats, activeChatId, onChatSelect, isMobile }) {
  const [searchQuery,   setSearchQuery]   = useState('');
  const [filter,        setFilter]        = useState('all');
  const [newChatOpen,   setNewChatOpen]   = useState(false);
  const { theme, setTheme }              = useTheme();
  const router                           = useRouter();
  const [logout]                         = useLogoutMutation();

  // Real authenticated user — replaces mock `currentUser`
  const currentUser           = useSelector((s) => s.auth.user);
  const notificationUnreadCount = useSelector(selectNotificationUnreadCount);

  // Shape currentUser for UserAvatar (needs .name not .displayName)
  const avatarUser = currentUser
    ? { ...currentUser, name: currentUser.displayName || currentUser.username }
    : null;

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Logout still clears local auth state via clearAuth; redirect anyway.
    } finally {
      router.replace('/login');
    }
  };

  const filteredChats = (chats ?? []).filter((chat) => {
    const matchesSearch =
      searchQuery === '' ||
      chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.participants ?? []).some((p) =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()),
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
        isMobile ? 'w-full' : 'w-80 shrink-0',
      )}
    >
      {/* Fixed header — shrink-0 prevents it from collapsing when the chat
          list grows. Without this the flex algorithm can steal height from
          the header to accommodate the ScrollArea's content. */}
      <div className="shrink-0 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-1">
            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notificationUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                    {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                  </span>
                )}
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  {avatarUser && <UserAvatar user={avatarUser} size="sm" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2">
                  <p className="font-medium">
                    {currentUser?.displayName || currentUser?.username || ''}
                  </p>
                  <p className="text-sm text-muted-foreground">{currentUser?.email || ''}</p>
                </div>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem>
                    <Users className="h-4 w-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings">
                  <DropdownMenuItem>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 mr-2" />
                  ) : (
                    <Moon className="h-4 w-4 mr-2" />
                  )}
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-10 bg-muted/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {CHAT_FILTERS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Scrollable chat list — flex-1 makes it grow, min-h-0 is the
          critical override. By default flex items have min-height:auto,
          which prevents shrinking below content height and pushes the
          footer button off screen. min-h-0 lets the flex algorithm assign
          a real bounded height so the Radix viewport's overflow:auto fires. */}
      <ScrollArea className="flex-1 min-h-0 px-2">
        {pinnedChats.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 px-3 py-2">
              <Star className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
              <div className="flex items-center gap-2 px-3 py-2">
                <Archive className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquarePlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        )}
      </ScrollArea>

      {/* Fixed footer — shrink-0 keeps this pinned to the bottom.
          The "New Conversation" button is always visible regardless of
          how many chats are in the scrollable area above. */}
      <div className="shrink-0 p-4 border-t border-sidebar-border space-y-2">
        <Button
          className="w-full gradient-primary text-white border-0 gap-2"
          onClick={() => setNewChatOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
        <Link href="/contacts" className="block">
          <Button variant="outline" className="w-full gap-2">
            <Users className="h-4 w-4" />
            Contacts
          </Button>
        </Link>
      </div>

      <NewConversationModal open={newChatOpen} onOpenChange={setNewChatOpen} />
    </div>
  );
}
