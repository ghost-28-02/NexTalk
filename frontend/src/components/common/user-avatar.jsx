'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { STATUS_COLORS } from '@/constants';

export function UserAvatar({ user, size = 'md', showStatus = true, className }) {
    const sizeClasses = {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
    };
    const statusSizeClasses = {
        sm: 'h-2 w-2 border',
        md: 'h-2.5 w-2.5 border-2',
        lg: 'h-3 w-3 border-2',
        xl: 'h-4 w-4 border-2',
    };
    const statusPositionClasses = {
        sm: '-right-0.5 -bottom-0.5',
        md: '-right-0.5 -bottom-0.5',
        lg: 'right-0 bottom-0',
        xl: 'right-0.5 bottom-0.5',
    };

    const displayName = user?.name || user?.displayName || user?.username || 'Unknown';
    const initials = displayName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase();

    return (
        <div className={cn('relative', className)}>
            <Avatar className={cn(sizeClasses[size], 'border-2 border-background')}>
                <AvatarImage src={user?.avatar} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {initials}
                </AvatarFallback>
            </Avatar>
            {showStatus && (
                <div
                    className={cn(
                        'absolute rounded-full border-background',
                        statusSizeClasses[size],
                        statusPositionClasses[size],
                        STATUS_COLORS[user.status] ?? 'bg-muted-foreground',
                    )}
                />
            )}
        </div>
    );
}

export function GroupAvatar({ avatars, size = 'md', className }) {
    const sizeClasses = {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
    };
    const displayAvatars = avatars.slice(0, 2);
    const remaining = avatars.length - 2;

    return (
        <div className={cn('relative', sizeClasses[size], className)}>
            {displayAvatars.map((avatar, index) => (
                <Avatar
                    key={index}
                    className={cn(
                        'absolute border-2 border-background',
                        size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-6 w-6' : 'h-7 w-7',
                        index === 0 ? 'top-0 left-0' : 'bottom-0 right-0',
                    )}
                >
                    <AvatarImage src={avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {remaining > 0 && index === 1 ? `+${remaining}` : ''}
                    </AvatarFallback>
                </Avatar>
            ))}
        </div>
    );
}
