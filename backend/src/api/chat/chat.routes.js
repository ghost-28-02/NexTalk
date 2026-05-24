const { Router } = require('express');
const controller = require('./chat.controller');
const { protect } = require('../../core/middleware/auth.middleware');

const router = Router();

router.use(protect);

router.get('/', controller.getMyChats);
router.post('/direct', controller.getOrCreateDirect);
router.post('/group', controller.createGroup);
router.get('/:id', controller.getChatById);
router.patch('/:id/read', controller.markRead);
router.delete('/:id/leave', controller.leaveChat);

module.exports = router;
