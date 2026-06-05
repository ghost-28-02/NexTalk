'use client';

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { useSocket } from '@/features/socket';
import { NOTIFICATION_EVENTS } from '@/features/socket/constants/socketEvents';
import {
  notificationReceived,
  allNotificationsMarkedRead,
  unreadCountSet,
} from '../store/notificationSlice';
import { chatUnreadIncremented } from '@/features/chat/store/chatSlice';
import { useGetUnreadCountQuery } from '../services/notificationApi';

/**
 * Icon map for toast display — simple emoji to avoid icon library overhead
 * in a global hook that runs on every page.
 */
const NOTIFICATION_ICONS = {
  message: '💬',
  mention: '@',
  call:    '📞',
  system:  '🔔',
};

/**
 * useNotificationSocket
 *
 * Wires server→client notification socket events into Redux state and
 * triggers Sonner toasts for foreground delivery.
 *
 * Mount strategy:
 *   Mounted once globally via NotificationInitializer in app-providers.jsx.
 *   Runs on every page so badge updates are always live, not just on the
 *   notifications page.
 *
 * Events handled:
 *   notification:new      — new notification pushed by server
 *   notification:read_all — another device marked all as read (cross-device sync)
 *   connect               — reconnect → resync badge count from server
 *
 * Toast suppression:
 *   Message notifications are suppressed when the user is already viewing
 *   that chat (activeChatId === notification.data.chatId). Other notification
 *   types (mention, call, system) always show a toast.
 */
export function useNotificationSocket() {
  const dispatch     = useDispatch();
  const socket       = useSocket();
  const activeChatId = useSelector((s) => s.chat?.activeChatId ?? null);

  // Stable ref so event handler closures never go stale
  const activeChatRef = useRef(activeChatId);
  activeChatRef.current = activeChatId;

  // Seed badge count from server on mount and keep it re-fetchable after reconnect
  const { refetch: refetchUnreadCount } = useGetUnreadCountQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (!socket) return;

    // ── notification:new ────────────────────────────────────────────────────

    const onNotificationNew = (notification) => {
      if (!notification?.id) return;

      // 1. Add to notification list — but only increment bell badge for non-message types.
      //    Message notifications are surfaced as chat unread badges, not the bell count.
      dispatch(notificationReceived({ ...notification, skipCount: notification.type === 'message' }));

      // 2. Bump unread badge on the chat entry in chatSlice.
      //    This handles the case where the user is NOT in the chat room
      //    (socket doesn't receive MESSAGE_SENT for rooms they haven't joined),
      //    ensuring the sidebar badge is always accurate.
      if (notification.type === 'message' && notification.data?.chatId) {
        dispatch(chatUnreadIncremented(notification.data.chatId));
      }

      // 3. Toast — suppress only for message notifications in the active chat.
      //    Mentions always toast (user needs to know even if in that chat).
      const isMessageInActiveChat =
        notification.type === 'message' &&
        notification.data?.chatId &&
        activeChatRef.current?.toString() === notification.data.chatId?.toString();

      if (!isMessageInActiveChat) {
        toast(notification.title, {
          description: notification.description ?? undefined,
          icon:        NOTIFICATION_ICONS[notification.type] ?? '🔔',
          duration:    4500,
        });
      }
    };

    // ── notification:read_all (cross-device sync) ───────────────────────────

    const onReadAll = () => {
      dispatch(allNotificationsMarkedRead());
    };

    // ── connect / reconnect — resync badge ──────────────────────────────────
    // If the user loses connectivity and reconnects, the badge count may be
    // stale. Re-fetch the authoritative count from the server.

    const onConnect = () => {
      refetchUnreadCount();
    };

    socket.on(NOTIFICATION_EVENTS.NEW,      onNotificationNew);
    socket.on(NOTIFICATION_EVENTS.READ_ALL, onReadAll);
    socket.on('connect',                    onConnect);

    return () => {
      socket.off(NOTIFICATION_EVENTS.NEW,      onNotificationNew);
      socket.off(NOTIFICATION_EVENTS.READ_ALL, onReadAll);
      socket.off('connect',                    onConnect);
    };
  }, [socket, dispatch, refetchUnreadCount]);
}
