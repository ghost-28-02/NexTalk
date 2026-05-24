'use client';

/**
 * usePresence — get the realtime presence status of a user.
 *
 * Returns the status that was last received via:
 *   presence:user_online  → 'online'
 *   presence:user_offline → 'offline'
 *   presence:status_change → the new status
 *   presence:bulk_status  → bulk update on connect
 *
 * Falls back to 'offline' if no presence data has been received yet.
 *
 * Usage:
 *   const { status, lastSeenAt, isOnline } = usePresence(userId);
 *
 *   // Conditional render:
 *   {isOnline ? <OnlineBadge /> : <LastSeenText at={lastSeenAt} />}
 */

import { useSelector } from 'react-redux';
import {
  selectPresenceStatus,
  selectPresenceLastSeen,
  selectIsOnline,
} from '../store/presenceSlice';

/**
 * @param {string | null | undefined} userId
 * @returns {{ status: string, lastSeenAt: string | null, isOnline: boolean }}
 */
export function usePresence(userId) {
  const status    = useSelector(selectPresenceStatus(userId ?? ''));
  const lastSeenAt = useSelector(selectPresenceLastSeen(userId ?? ''));
  const isOnline  = useSelector(selectIsOnline(userId ?? ''));

  return { status, lastSeenAt, isOnline };
}
