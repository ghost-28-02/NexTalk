'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

/**
 * Wraps public auth pages (the (auth) route group).
 *
 * Behaviour:
 *   - While isInitialized is false: render a minimal loading state.
 *   - After initialization: if already authenticated, redirect to /chat.
 *   - If not authenticated: render the auth page normally.
 *
 * Prevents authenticated users from re-visiting /login, /signup, etc.
 */
export function GuestGuard({ children }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      router.replace('/chat');
    }
  }, [isAuthenticated, isInitialized, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return children;
}
