import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Creates a new Socket.IO client instance.
 * Auth is handled via the httpOnly JWT cookie — withCredentials sends it automatically.
 * The socket is NOT connected yet — call socket.connect() to establish.
 *
 * @returns {import('socket.io-client').Socket}
 */
export function createSocket() {
  return io(SOCKET_URL, {
    // Send cookies (including nx_token) in the handshake automatically
    withCredentials: true,

    transports: ['websocket', 'polling'],
    autoConnect: false,

    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 20000,
  });
}
