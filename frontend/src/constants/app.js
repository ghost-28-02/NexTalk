export const MOBILE_BREAKPOINT = 768;

export const USER_STATUS = {
    ONLINE: 'online',
    OFFLINE: 'offline',
    AWAY: 'away',
    BUSY: 'busy',
};

export const STATUS_COLORS = {
    online: 'bg-success',
    offline: 'bg-muted-foreground',
    away: 'bg-warning',
    busy: 'bg-destructive',
};

export const NAV_ITEMS = [
    { href: '/chat', icon: 'MessageSquare', label: 'Chats' },
    { href: '/contacts', icon: 'Users', label: 'Contacts' },
    { href: '/notifications', icon: 'Bell', label: 'Alerts' },
    { href: '/settings', icon: 'Settings', label: 'Settings' },
    { href: '/profile', icon: 'User', label: 'Profile' },
];

export const CHAT_FILTERS = ['all', 'unread', 'groups'];

export const NOTIFICATION_TYPES = {
    MESSAGE: 'message',
    CALL: 'call',
    MENTION: 'mention',
    SYSTEM: 'system',
};
