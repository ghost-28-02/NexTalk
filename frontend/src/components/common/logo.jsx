'use client';

import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';

export function Logo({ className, showText = true, size = 'md' }) {
    const sizeClasses = {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
    };
    const textSizeClasses = {
        sm: 'text-lg',
        md: 'text-xl',
        lg: 'text-2xl',
    };

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div
                className={cn(
                    'relative flex items-center justify-center rounded-xl gradient-primary',
                    sizeClasses[size],
                )}
            >
                <MessageSquare className="h-1/2 w-1/2 text-white" />
                <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-background" />
            </div>
            {showText && (
                <span className={cn('font-bold tracking-tight', textSizeClasses[size])}>
                    Nex<span className="text-primary">Talk</span>
                </span>
            )}
        </div>
    );
}
