export const chatMessages = {
    'chat-1': [
        {
            id: 'msg-1',
            senderId: 'user-2',
            content: "Hey! How's the new project coming along?",
            timestamp: '10:30 AM',
            type: 'text',
            status: 'read',
        },
        {
            id: 'msg-2',
            senderId: 'user-1',
            content: 'Going great! Just finished the design mockups. Want to review them?',
            timestamp: '10:32 AM',
            type: 'text',
            status: 'read',
        },
        {
            id: 'msg-3',
            senderId: 'user-2',
            content: "Absolutely! Send them over when you're ready.",
            timestamp: '10:33 AM',
            type: 'text',
            status: 'read',
        },
        {
            id: 'msg-4',
            senderId: 'user-1',
            content: "Perfect. I'll share the Figma link in a bit.",
            timestamp: '10:35 AM',
            type: 'text',
            status: 'delivered',
        },
        {
            id: 'msg-5',
            senderId: 'user-2',
            content: 'Sounds good! Also, are you joining the team standup at 2?',
            timestamp: '10:40 AM',
            type: 'text',
            status: 'read',
        },
        {
            id: 'msg-6',
            senderId: 'user-1',
            content: "Yes, I'll be there. Need to discuss the timeline.",
            timestamp: '10:42 AM',
            type: 'text',
            status: 'sent',
        },
    ],
    'chat-2': [
        {
            id: 'msg-10',
            senderId: 'user-3',
            content: 'The new landing page looks amazing!',
            timestamp: '9:15 AM',
            type: 'text',
            status: 'read',
        },
        {
            id: 'msg-11',
            senderId: 'user-1',
            content: 'Thanks! Took a while to get the animations right.',
            timestamp: '9:20 AM',
            type: 'text',
            status: 'read',
        },
    ],
    'chat-3': [
        {
            id: 'msg-20',
            senderId: 'user-4',
            content: 'Can you send me the updated requirements doc?',
            timestamp: 'Yesterday',
            type: 'text',
            status: 'read',
        },
    ],
    'chat-group-1': [
        {
            id: 'msg-30',
            senderId: 'user-5',
            content: 'Team, we need to finalize the API specs today.',
            timestamp: '11:00 AM',
            type: 'text',
            status: 'read',
        },
        {
            id: 'msg-31',
            senderId: 'user-2',
            content: "I've updated the endpoints. Check the wiki.",
            timestamp: '11:05 AM',
            type: 'text',
            status: 'read',
        },
        {
            id: 'msg-32',
            senderId: 'user-7',
            content: 'Will review and merge the PR this afternoon.',
            timestamp: '11:10 AM',
            type: 'text',
            status: 'read',
        },
        {
            id: 'msg-33',
            senderId: 'user-1',
            content: "Great progress everyone! Let's sync up tomorrow.",
            timestamp: '11:15 AM',
            type: 'text',
            status: 'sent',
        },
    ],
};

export function formatMessageTime(timestamp) {
    return timestamp;
}
