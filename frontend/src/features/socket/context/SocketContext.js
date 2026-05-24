/**
 * SocketContext — provides the active Socket.IO instance to the component tree.
 *
 * Usage:
 *   import { useSocket } from '@/features/socket';
 *   const socket = useSocket();
 *   if (socket) socket.emit('chat:new_message', { ... });
 *
 * The value is null when:
 *   - The user is not authenticated
 *   - The socket is still connecting
 *   - The socket has been disconnected (logout)
 *
 * Check socket.connected before emitting if you need the socket to be active.
 */

'use client';

import { createContext, useContext } from 'react';

export const SocketContext = createContext(null);

/**
 * useSocket — hook to access the socket instance.
 * Returns null when no socket is active (unauthenticated or disconnected).
 *
 * @returns {import('socket.io-client').Socket | null}
 */
export function useSocket() {
  return useContext(SocketContext);
}
