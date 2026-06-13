'use client';

import { Provider } from 'react-redux';
import { ThemeProvider } from './theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { store } from '@/store';
import { useAuthInit } from '@/features/auth/hooks/useAuthInit';
import { SocketProvider } from '@/features/socket';
import { useNotificationSocket } from '@/features/notification';
import { useCallSocket, IncomingCallModal } from '@/features/call';

function AuthInitializer() {
  useAuthInit();
  return null;
}

function NotificationInitializer() {
  useNotificationSocket();
  return null;
}

// Global inbound-call listener — rings on any page (must be inside SocketProvider)
function CallInitializer() {
  useCallSocket();
  return null;
}

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
          <CallInitializer />
          <IncomingCallModal />
          {children}
        </SocketProvider>
        <Toaster />
      </ThemeProvider>
    </Provider>
  );
}
