'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import { MessageSquare, Users, Bell, Settings, User } from 'lucide-react';
import { selectNotificationUnreadCount } from '@/features/notification/store/notificationSlice';

const navItems = [
    { href: '/chat',          icon: MessageSquare, label: 'Chats' },
    { href: '/contacts',      icon: Users,         label: 'Contacts' },
    { href: '/notifications', icon: Bell,          label: 'Alerts', showBadge: true },
    { href: '/settings',      icon: Settings,      label: 'Settings' },
    { href: '/profile',       icon: User,          label: 'Profile' },
];

export function MobileNav() {
    const pathname      = usePathname();
    const unreadCount   = useSelector(selectNotificationUnreadCount);

    return (
        <nav className="h-16 border-t border-border bg-card/80 backdrop-blur-lg shrink-0 safe-area-bottom">
            <div className="flex items-center justify-around h-full px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const badge    = item.showBadge ? unreadCount : 0;
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
                            <div className="relative">
                                <item.icon className={cn('h-5 w-5', isActive && 'fill-primary/20')} />
                                {badge > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                                        {badge > 99 ? '99+' : badge}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
