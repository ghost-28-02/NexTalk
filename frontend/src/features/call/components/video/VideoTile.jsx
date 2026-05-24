'use client';

import { useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';
import { UserAvatar } from '@/components/common';
import { cn } from '@/lib/utils';

/**
 * A single video tile — works for both local (self) and remote streams.
 * When stream is null or video is off, shows the user's avatar instead.
 */
export function VideoTile({
  stream,
  user,
  isMuted = false,
  isVideoOff = false,
  isSelf = false,
  className,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const showAvatar = isVideoOff || !stream;

  return (
    <div className={cn('relative bg-muted rounded-2xl overflow-hidden', className)}>
      {showAvatar ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <UserAvatar user={user} size="xl" showStatus={false} className="h-20 w-20" />
          <p className="text-sm text-white/80 font-medium">
            {isSelf ? 'You (camera off)' : user?.name}
          </p>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={cn('w-full h-full object-cover', isSelf && 'scale-x-[-1]')}
        />
      )}

      {isMuted && (
        <div className="absolute bottom-2 left-2 bg-black/60 rounded-full p-1.5">
          <MicOff className="h-3 w-3 text-white" />
        </div>
      )}
    </div>
  );
}
