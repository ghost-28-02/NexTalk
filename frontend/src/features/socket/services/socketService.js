import { io } from 'socket.io-client';

// Sockets connect directly to the backend (bypasses Next.js proxy).
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Creates a new Socket.IO client instance.
 * @param {string} token — JWT passed in socket.auth.token for the backend socketAuth middleware.
 *   In production the cookie lives on the Vercel domain (not the backend domain), so we pass
 *   the token explicitly rather than relying on withCredentials.
 */
export function createSocket(token) {
  return io(SOCKET_URL, {
    auth: { token },
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
