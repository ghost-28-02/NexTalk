// Provider
export { SocketProvider } from './providers/SocketProvider';

// Context + hook
export { SocketContext, useSocket } from './context/SocketContext';

// Store (slice + actions + selectors)
export {
  default as socketReducer,
  socketConnecting,
  socketConnected,
  socketReconnecting,
  socketDisconnected,
  socketError,
  socketReset,
  selectSocketStatus,
  selectIsSocketConnected,
  selectSocketReconnecting,
  selectReconnectAttempts,
  selectSocketError,
} from './store/socketSlice';

// Hooks
export { useTyping } from './hooks/useTyping';

// Event constants
export {
  CHAT_EVENTS,
  PRESENCE_EVENTS,
  NOTIFICATION_EVENTS,
  SYSTEM_EVENTS,
} from './constants/socketEvents';
