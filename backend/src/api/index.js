const { Router } = require('express');
const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./user/user.routes');
const chatRoutes = require('./chat/chat.routes');
const messageRoutes = require('./message/message.routes');
const notificationRoutes = require('./notification/notification.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/chats', chatRoutes);
router.use('/chats/:chatId/messages', messageRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
