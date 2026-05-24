const { Router } = require('express');
const controller = require('./message.controller');
const { protect } = require('../../core/middleware/auth.middleware');

const router = Router({ mergeParams: true });

router.use(protect);

router.get('/',                         controller.getMessages);
router.post('/',                        controller.sendMessage);
router.post('/media',                   controller.sendMediaMessage);
router.patch('/:messageId',             controller.editMessage);
router.delete('/:messageId',            controller.deleteMessage);
router.post('/:messageId/reactions',    controller.addReaction);
router.delete('/:messageId/reactions',  controller.removeReaction);

module.exports = router;
