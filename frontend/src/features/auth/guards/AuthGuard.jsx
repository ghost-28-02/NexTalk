'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

/**
 * Wraps protected pages (the (main) route group).
 *
 * Behaviour:
 *   - While isInitialized is false: render a loading screen (prevents
 *     flash-of-unauthenticated-content while the session-restore request is in flight).
 *   - After initialization: if not authenticated, redirect to /login.
 *   - If authenticated: render children normally.
 *
 * Works as Layer 2 after proxy.js (Layer 1).
 * proxy.js does a fast cookie check; AuthGuard validates real session state.
 */
export function AuthGuard({ children }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitialized, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return children;
}
