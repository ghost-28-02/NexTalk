'use client';

import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { MobileNav } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  Phone,
  AtSign,
  Settings,
  Check,
  MoreVertical,
  Trash2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  selectNotifications,
  selectNotificationUnreadCount,
  selectNotificationsLoaded,
} from '@/features/notification/store/notificationSlice';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from '@/features/notification/services/notificationApi';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const notificationIcons = {
  message: MessageSquare,
  call:    Phone,
  mention: AtSign,
  system:  Bell,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7)  return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Notification item ────────────────────────────────────────────────────────

function NotificationItem({ notification }) {
  const [markRead]   = useMarkNotificationReadMutation();
  const [deleteNotif] = useDeleteNotificationMutation();

  const Icon       = notificationIcons[notification.type] ?? Bell;
  const avatarUrl  = notification.sender?.avatar ?? null;
  const senderInitials = (notification.sender?.displayName || notification.sender?.username || 'N')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl transition-colors group cursor-default',
        notification.isRead
          ? 'bg-transparent hover:bg-muted/50'
          : 'bg-primary/5 hover:bg-primary/10',
      )}
      onClick={() => {
        if (!notification.isRead) markRead(notification.id);
      }}
    >
      {/* Avatar / icon */}
      {avatarUrl ? (
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {senderInitials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn('font-medium truncate', !notification.isRead && 'text-primary')}>
              {notification.title}
            </p>
            {notification.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                {notification.description}
              </p>
            )}
          </div>
          {!notification.isRead && (
            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!notification.isRead && (
            <DropdownMenuItem onClick={() => markRead(notification.id)}>
              <Check className="h-4 w-4 mr-2" />
              Mark as read
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => deleteNotif(notification.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ allRead }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {allRead ? (
          <Check className="h-8 w-8 text-muted-foreground" />
        ) : (
          <Bell className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <p className="font-medium">{allRead ? 'All caught up!' : 'No notifications'}</p>
      <p className="text-sm text-muted-foreground mt-1">
        {allRead ? 'No unread notifications' : "You're all caught up!"}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const router = useRouter();

  // Slice state — source of truth
  const notifications  = useSelector(selectNotifications);
  const unreadCount    = useSelector(selectNotificationUnreadCount);
  const isLoaded       = useSelector(selectNotificationsLoaded);

  // Seed the slice on page mount (no-op if already loaded by NotificationInitializer)
  const { isFetching } = useGetNotificationsQuery({}, {
    refetchOnMountOrArgChange: false,
  });

  const [markAllRead] = useMarkAllNotificationsReadMutation();

  const unreadNotifications = notifications.filter((n) => !n.isRead);

  return (
    <div className="h-screen bg-background flex flex-col">

      {/* Sticky back header like Edit Profile */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-semibold text-sm">Notifications</h1>
          <p className="text-[11px] text-muted-foreground">Manage your notifications</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isFetching && !isLoaded && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAllRead()}>
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-4 w-fit">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
        </TabsList>

        {/* All notifications */}
        <TabsContent value="all" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-1">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
              {notifications.length === 0 && !isFetching && (
                <EmptyState allRead={false} />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Unread only */}
        <TabsContent value="unread" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-1">
              {unreadNotifications.map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
              {unreadNotifications.length === 0 && (
                <EmptyState allRead />
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="md:hidden">
        <MobileNav activePage="alerts" />
      </div>
    </div>
  );
}
