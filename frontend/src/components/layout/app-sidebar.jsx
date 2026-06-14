'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Logo, UserAvatar } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MessageSquare, Phone, Users, Bell, Settings, Moon, Sun, LogOut,
} from 'lucide-react';
import { useLogoutMutation } from '@/features/auth';
import { selectNotificationUnreadCount } from '@/features/notification/store/notificationSlice';

// ─── Icon button with tooltip ─────────────────────────────────────────────────

function NavIcon({ href, icon: Icon, label, isActive, badge, onClick }) {
  const btn = (
    <button
      onClick={onClick}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-5 w-5" />
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );

  const inner = href ? <Link href={href}>{btn}</Link> : btn;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{inner}</span>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const dispatch  = useDispatch();
  const { theme, setTheme } = useTheme();
  const [logout]  = useLogoutMutation();
  const currentUser           = useSelector((s) => s.auth.user);
  const notificationUnreadCount = useSelector(selectNotificationUnreadCount);

  const avatarUser = currentUser
    ? { ...currentUser, name: currentUser.displayName || currentUser.username }
    : null;

  const handleLogout = async () => {
    try { await logout().unwrap(); } catch { /* ignore */ }
    finally { router.replace('/login'); }
  };

  const navItems = [
    { href: '/chat',          icon: MessageSquare, label: 'Chats' },
    { href: '/calls',         icon: Phone,         label: 'Calls' },
    { href: '/contacts',      icon: Users,         label: 'Contacts' },
    { href: '/notifications', icon: Bell,          label: 'Notifications', badge: notificationUnreadCount },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <aside className="flex flex-col items-center w-16 shrink-0 bg-sidebar border-r border-sidebar-border h-full py-3 gap-1">

        {/* Logo */}
        <div className="mb-4 mt-1">
          <Logo size="sm" showText={false} />
        </div>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map(({ href, icon, label, badge }) => (
            <NavIcon
              key={href}
              href={href}
              icon={icon}
              label={label}
              isActive={pathname.startsWith(href)}
              badge={badge}
            />
          ))}
        </nav>

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-1 mt-auto">
          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition-all',
                  pathname.startsWith('/settings')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Settings className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Settings</TooltipContent>
          </Tooltip>

          {/* Profile avatar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/profile"
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition-all',
                  pathname.startsWith('/profile')
                    ? 'ring-2 ring-primary'
                    : 'hover:opacity-80',
                )}
              >
                {avatarUser && (
                  <UserAvatar user={avatarUser} size="sm" showStatus={false} className="h-8 w-8" />
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {currentUser?.displayName || currentUser?.username || 'Profile'}
            </TooltipContent>
          </Tooltip>

          {/* Sign out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
