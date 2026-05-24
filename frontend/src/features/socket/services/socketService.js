/**
 * socketService — Socket.IO client factory.
 *
 * Responsibilities:
 *   - Creates the socket instance (once, lazily)
 *   - Configures connection options
 *   - Provides the active instance for SocketProvider
 *
 * Design:
 *   - Does NOT auto-connect (autoConnect: false) — the SocketProvider decides
 *     when to connect based on auth state.
 *   - The access token is passed in socket.auth so the server's socketAuth
 *     middleware can read it from socket.handshake.auth.token.
 *   - A new instance is created each time createSocket() is called
 *     (previous instance should be disconnected first).
 *
 * IMPORTANT: Do NOT import this module in components directly.
 * Use the useSocket() hook from SocketContext instead.
 */

import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Creates a new Socket.IO client instance.
 * The socket is NOT connected yet — call socket.connect() to establish.
 *
 * @param {string} accessToken — JWT access token for socket authentication
 * @returns {import('socket.io-client').Socket}
 */
export function createSocket(accessToken) {
  return io(SOCKET_URL, {
    // Token sent in handshake.auth — read by server socketAuth middleware
    auth: { token: accessToken },

    // Prefer WebSocket, fall back to polling if necessary
    transports: ['websocket', 'polling'],

    // Do NOT connect immediately — SocketProvider controls the connect() call
    autoConnect: false,

    // Reconnect strategy: exponential backoff, max 5 attempts
    // After 5 failures, SocketProvider handles connect_error manually
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,       // 1s initial delay
    reconnectionDelayMax: 10000,   // max 10s between attempts
    randomizationFactor: 0.5,      // add jitter to avoid thundering herd

    // Socket.IO timeout for initial connection handshake
    timeout: 20000,

    // Must match server `pingTimeout` and `pingInterval`
    // (server: pingTimeout=60000, pingInterval=25000)
  });
}
