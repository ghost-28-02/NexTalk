export const currentUser = {
    id: 'user-1',
    name: 'Alex Morgan',
    email: 'alex@nextalk.app',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    status: 'online',
    bio: 'Product Designer | Coffee Enthusiast',
    phone: '+1 (555) 123-4567',
};

export const users = [
    {
        id: 'user-2',
        name: 'Sarah Chen',
        email: 'sarah@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
        status: 'online',
        bio: 'Full Stack Developer',
    },
    {
        id: 'user-3',
        name: 'Marcus Johnson',
        email: 'marcus@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
        status: 'away',
        lastSeen: '5 min ago',
        bio: 'UI/UX Designer',
    },
    {
        id: 'user-4',
        name: 'Emily Davis',
        email: 'emily@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
        status: 'offline',
        lastSeen: '2 hours ago',
        bio: 'Project Manager',
    },
    {
        id: 'user-5',
        name: 'James Wilson',
        email: 'james@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
        status: 'online',
        bio: 'Backend Engineer',
    },
    {
        id: 'user-6',
        name: 'Lisa Park',
        email: 'lisa@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa',
        status: 'busy',
        bio: 'Marketing Lead',
    },
    {
        id: 'user-7',
        name: 'David Kim',
        email: 'david@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
        status: 'online',
        bio: 'DevOps Engineer',
    },
    {
        id: 'user-8',
        name: 'Rachel Green',
        email: 'rachel@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rachel',
        status: 'offline',
        lastSeen: '1 day ago',
        bio: 'Content Writer',
    },
];

export function getUserById(userId) {
    if (userId === currentUser.id) return currentUser;
    return users.find((u) => u.id === userId);
}
