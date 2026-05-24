'use client';

import { Provider } from 'react-redux';
import { ThemeProvider } from './theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { store } from '@/store';
import { useAuthInit } from '@/features/auth/hooks/useAuthInit';
import { SocketProvider } from '@/features/socket';
import { useNotificationSocket } from '@/features/notification';

/**
 * Fires POST /auth/refresh on every app mount to restore the session from
 * the httpOnly refresh token cookie. Sets isInitialized=true when done
 * (whether session was restored or not) so AuthGuard / GuestGuard can render.
 *
 * Must be inside <Provider store={store}> so it can dispatch to Redux.
 * Must be inside <SocketProvider> so the socket can be created after auth restores.
 */
function AuthInitializer() {
  useAuthInit();
  return null;
}

/**
 * Mounts useNotificationSocket globally so notification badge and toasts
 * work on every page — not just the notifications page.
 *
 * Must be inside <SocketProvider> (needs the socket instance) and inside
 * <Provider> (dispatches to Redux).
 */
function NotificationInitializer() {
  useNotificationSocket();
  return null;
}

/**
 * Provider tree (order matters):
 *
 *   Provider (Redux store)
 *     ThemeProvider
 *       AuthInitializer        ← restores session on mount (sets isAuthenticated)
 *       SocketProvider         ← watches isAuthenticated; creates socket when true
 *         NotificationInitializer  ← wires notification socket events globally
 *         children
 *       Toaster
 *
 * SocketProvider reads auth state from Redux, so it must be inside <Provider>.
 * It activates only when isAuthenticated = true (set by AuthInitializer's refresh call).
 * NotificationInitializer must be inside SocketProvider so useSocket() returns the instance.
 */
export function AppProviders({ children }) {
  return (
    <Provider store={store}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <AuthInitializer />
        <SocketProvider>
          <NotificationInitializer />
          {children}
        </SocketProvider>
        <Toaster />
      </ThemeProvider>
    </Provider>
  );
}
