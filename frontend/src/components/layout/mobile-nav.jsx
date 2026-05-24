'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MessageSquare, Users, Bell, Settings, User } from 'lucide-react';

const navItems = [
    { href: '/chat', icon: MessageSquare, label: 'Chats' },
    { href: '/contacts', icon: Users, label: 'Contacts' },
    { href: '/notifications', icon: Bell, label: 'Alerts' },
    { href: '/settings', icon: Settings, label: 'Settings' },
    { href: '/profile', icon: User, label: 'Profile' },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav className="h-16 border-t border-border bg-card/80 backdrop-blur-lg shrink-0 safe-area-bottom">
            <div className="flex items-center justify-around h-full px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-colors',
                                isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <item.icon className={cn('h-5 w-5', isActive && 'fill-primary/20')} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
