'use client';

import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Bell, MessageSquare, Phone, AtSign,
  Settings, Check, Trash2, Loader2, UserPlus, UserCheck, Users,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
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
import { activeChatSet } from '@/features/chat/store/chatSlice';

// ─── Config ───────────────────────────────────────────────────────────────────

const NOTIF_CONFIG = {
  message:          { Icon: MessageSquare, color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  mention:          { Icon: AtSign,        color: 'text-purple-500', bg: 'bg-purple-500/10' },
  call:             { Icon: Phone,         color: 'text-green-500',  bg: 'bg-green-500/10'  },
  contact_request:  { Icon: UserPlus,      color: 'text-orange-500', bg: 'bg-orange-500/10' },
  contact_accepted: { Icon: UserCheck,     color: 'text-green-500',  bg: 'bg-green-500/10'  },
  group_invite:     { Icon: Users,         color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  system:           { Icon: Bell,          color: 'text-primary',    bg: 'bg-primary/10'    },
};

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
  const router        = useRouter();
  const dispatch      = useDispatch();
  const [markRead]    = useMarkNotificationReadMutation();
  const [deleteNotif] = useDeleteNotificationMutation();

  const config = NOTIF_CONFIG[notification.type] ?? NOTIF_CONFIG.system;
  const { Icon, color, bg } = config;

  const avatarUrl      = notification.sender?.avatar ?? null;
  const senderInitials = (notification.sender?.displayName || notification.sender?.username || 'N')
    .slice(0, 2).toUpperCase();

  // Navigate based on notification type
  const handleClick = async () => {
    // Mark read
    if (!notification.isRead) {
      await markRead(notification.id);
    }

    // Delete after read
    deleteNotif(notification.id);

    // Navigate
    const chatId = notification.data?.chatId;
    if (chatId && (notification.type === 'message' || notification.type === 'mention')) {
      dispatch(activeChatSet(chatId));
      router.push('/chat');
    } else if (notification.type === 'contact_request' || notification.type === 'contact_accepted') {
      router.push('/contacts?tab=pending');
    } else if (notification.type === 'group_invite') {
      router.push('/chat');
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer',
        notification.isRead
          ? 'hover:bg-muted/50'
          : 'bg-primary/5 hover:bg-primary/8',
      )}
      onClick={handleClick}
    >
      {/* Avatar or icon */}
      <div className="relative shrink-0">
        {avatarUrl ? (
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className={cn('text-sm font-medium', bg, color)}>
              {senderInitials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center',
            'backdrop-blur-md border border-white/10 shadow-sm',
            bg,
          )}>
            <Icon className={cn('h-5 w-5', color)} />
          </div>
        )}
        {/* Type badge on avatar */}
        {avatarUrl && (
          <div className={cn(
            'absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center',
            'border-2 border-background backdrop-blur-md shadow-sm',
            bg,
          )}>
            <Icon className={cn('h-2.5 w-2.5', color)} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium truncate', !notification.isRead && 'text-foreground')}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
          )}
        </div>
        {(notification.description || notification.body) && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {notification.description || notification.body}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
        <Bell className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();

  const allNotifications = useSelector(selectNotifications);
  const unreadCount      = useSelector(selectNotificationUnreadCount);
  const isLoaded         = useSelector(selectNotificationsLoaded);

  const { isFetching } = useGetNotificationsQuery({}, { refetchOnMountOrArgChange: false });
  const [markAllRead]  = useMarkAllNotificationsReadMutation();

  // Exclude plain message notifications — those are already visible as
  // unread badges in the chat sidebar. Show only actionable notifications.
  const notifications       = allNotifications.filter((n) => n.type !== 'message');
  const unreadNotifications = notifications.filter((n) => !n.isRead);

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3 shrink-0">
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-[11px] text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isFetching && !isLoaded && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => markAllRead()}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Mark all read
            </Button>
          )}
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 w-fit shrink-0">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-0.5">
              {notifications.length === 0 && !isFetching
                ? <EmptyState label="No notifications" />
                : notifications.map((n) => <NotificationItem key={n.id} notification={n} />)
              }
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="unread" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-0.5">
              {unreadNotifications.length === 0
                ? <EmptyState label="No unread notifications" />
                : unreadNotifications.map((n) => <NotificationItem key={n.id} notification={n} />)
              }
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

    </div>
  );
}
