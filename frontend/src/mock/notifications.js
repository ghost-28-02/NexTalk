import { users } from './users';

export const notifications = [
    {
        id: 'notif-1',
        type: 'message',
        title: 'Sarah Chen',
        description: 'Sent you a message',
        timestamp: '2 min ago',
        isRead: false,
        avatar: users[0].avatar,
    },
    {
        id: 'notif-2',
        type: 'call',
        title: 'Missed call',
        description: 'Marcus Johnson tried to call you',
        timestamp: '15 min ago',
        isRead: false,
        avatar: users[1].avatar,
    },
    {
        id: 'notif-3',
        type: 'mention',
        title: 'Project Alpha Team',
        description: 'James mentioned you in a message',
        timestamp: '1 hour ago',
        isRead: true,
        avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=alpha',
    },
    {
        id: 'notif-4',
        type: 'system',
        title: 'New feature available',
        description: 'Video calls now support screen sharing',
        timestamp: 'Yesterday',
        isRead: true,
    },
    {
        id: 'notif-5',
        type: 'message',
        title: 'Design System',
        description: 'Lisa shared 3 new files',
        timestamp: 'Yesterday',
        isRead: true,
        avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=design',
    },
];
