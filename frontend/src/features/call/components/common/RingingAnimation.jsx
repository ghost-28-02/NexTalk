import { UserAvatar } from '@/components/common';

/**
 * Caller avatar with optional ping ring animation for ringing state.
 */
export function RingingAnimation({ user, isRinging = false, size = 'xl', className = 'h-32 w-32' }) {
  return (
    <div className="relative inline-flex">
      {isRinging && (
        <div
          className="absolute inset-0 rounded-full bg-primary/20 animate-ping"
          style={{ animationDuration: '2s' }}
        />
      )}
      <UserAvatar user={user} size={size} showStatus={false} className={className} />
    </div>
  );
}
