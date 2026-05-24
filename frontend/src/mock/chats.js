import { currentUser, users } from './users';
import { chatMessages } from './messages';

export const chats = [
    {
        id: 'chat-1',
        type: 'direct',
        participants: [currentUser, users[0]],
        lastMessage: chatMessages['chat-1'][chatMessages['chat-1'].length - 1],
        unreadCount: 2,
        isPinned: true,
        createdAt: '2024-01-15',
    },
    {
        id: 'chat-group-1',
        type: 'group',
        name: 'Project Alpha Team',
        avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=alpha',
        participants: [currentUser, users[0], users[1], users[4], users[5]],
        lastMessage: chatMessages['chat-group-1'][chatMessages['chat-group-1'].length - 1],
        unreadCount: 5,
        isPinned: true,
        createdAt: '2024-01-10',
    },
    {
        id: 'chat-2',
        type: 'direct',
        participants: [currentUser, users[1]],
        lastMessage: chatMessages['chat-2'][chatMessages['chat-2'].length - 1],
        unreadCount: 0,
        createdAt: '2024-01-12',
    },
    {
        id: 'chat-3',
        type: 'direct',
        participants: [currentUser, users[2]],
        lastMessage: chatMessages['chat-3'][chatMessages['chat-3'].length - 1],
        unreadCount: 1,
        createdAt: '2024-01-08',
    },
    {
        id: 'chat-4',
        type: 'direct',
        participants: [currentUser, users[3]],
        lastMessage: {
            id: 'msg-40',
            senderId: 'user-5',
            content: 'Let me check the deployment status.',
            timestamp: '2 days ago',
            type: 'text',
            status: 'read',
        },
        unreadCount: 0,
        createdAt: '2024-01-05',
    },
    {
        id: 'chat-group-2',
        type: 'group',
        name: 'Design System',
        avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=design',
        participants: [currentUser, users[0], users[1], users[6]],
        lastMessage: {
            id: 'msg-50',
            senderId: 'user-3',
            content: 'New components are ready for review',
            timestamp: 'Yesterday',
            type: 'text',
            status: 'read',
        },
        unreadCount: 0,
        isMuted: true,
        createdAt: '2024-01-01',
    },
];

export function getChatName(chat, currentUserId) {
    if (chat.type === 'group') return chat.name || 'Group Chat';
    const other = chat.participants.find((p) => p.id !== currentUserId);
    return other?.name || 'Unknown';
}

export function getChatAvatar(chat, currentUserId) {
    if (chat.type === 'group') return chat.avatar || '';
    const other = chat.participants.find((p) => p.id !== currentUserId);
    return other?.avatar || '';
}

export function getOtherParticipant(chat, currentUserId) {
    return chat.participants.find((p) => p.id !== currentUserId);
}
