'use client';

/**
 * AvatarUpload — Avatar ring with camera-overlay button and upload progress.
 *
 * Features:
 *   - Displays the current avatar (or initials fallback)
 *   - Shows a local preview immediately on file selection (before server confirms)
 *   - Camera overlay appears on hover for discoverability
 *   - Spinner overlaid while upload is in progress
 *   - Hidden <input type="file"> delegated to useAvatarUpload hook
 *   - Accepts arbitrary className for layout positioning
 *
 * Props:
 *   currentAvatarUrl  — current server-confirmed avatar URL
 *   displayName       — user's display name (for initials fallback)
 *   size              — 'sm' | 'md' | 'lg' | 'xl'  (default: 'lg')
 *   editable          — boolean (default: true) — hide camera overlay if false
 *   className         — extra Tailwind classes for the wrapper
 */

import { Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAvatarUpload } from '../hooks/useAvatarUpload';

const SIZE_MAP = {
  sm: { ring: 'h-10 w-10',  icon: 'h-3 w-3', text: 'text-xs'  },
  md: { ring: 'h-16 w-16',  icon: 'h-4 w-4', text: 'text-sm'  },
  lg: { ring: 'h-24 w-24',  icon: 'h-5 w-5', text: 'text-xl'  },
  xl: { ring: 'h-32 w-32',  icon: 'h-6 w-6', text: 'text-2xl' },
};

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function AvatarUpload({
  currentAvatarUrl,
  displayName = '',
  size = 'lg',
  editable = true,
  className,
}) {
  const {
    inputRef,
    previewUrl,
    isUploading,
    openFilePicker,
    handleFileChange,
  } = useAvatarUpload();

  const { ring, icon, text } = SIZE_MAP[size] ?? SIZE_MAP.lg;

  // Priority: local preview (instant) → server avatar → initials fallback
  const displaySrc = previewUrl ?? currentAvatarUrl;
  const initials   = getInitials(displayName);

  return (
    <div className={cn('relative inline-block', className)}>
      {/* ── Avatar ring ───────────────────────────────────────────────────── */}
      <div
        className={cn(
          ring,
          'relative rounded-full overflow-hidden bg-muted flex items-center justify-center',
          'ring-2 ring-background',
          editable && !isUploading && 'cursor-pointer group'
        )}
        onClick={editable && !isUploading ? openFilePicker : undefined}
        role={editable ? 'button' : undefined}
        aria-label={editable ? 'Change avatar' : undefined}
        tabIndex={editable ? 0 : undefined}
        onKeyDown={
          editable
            ? (e) => { if (e.key === 'Enter' || e.key === ' ') openFilePicker(); }
            : undefined
        }
      >
        {/* Avatar image or initials */}
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={displayName || 'Avatar'}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className={cn('font-semibold text-muted-foreground select-none', text)}>
            {initials || '?'}
          </span>
        )}

        {/* ── Camera overlay (hover, editable only) ─────────────────────── */}
        {editable && !isUploading && (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150',
            )}
            aria-hidden
          >
            <Camera className={cn(icon, 'text-white')} />
          </div>
        )}

        {/* ── Upload spinner overlay ────────────────────────────────────── */}
        {isUploading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/50"
            aria-label="Uploading avatar"
          >
            <Loader2 className={cn(icon, 'text-white animate-spin')} />
          </div>
        )}
      </div>

      {/* ── Hidden file input ─────────────────────────────────────────────── */}
      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden
        />
      )}
    </div>
  );
}
