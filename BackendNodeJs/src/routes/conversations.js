const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/conversationsController');

router.get('/', authenticate, ctrl.getAll);
router.get('/unread', authenticate, ctrl.getUnreadCount);
router.post('/', authenticate, ctrl.create);
router.get('/:id/messages', authenticate, ctrl.getMessages);
router.post('/:id/messages', authenticate, ctrl.sendMessage);
router.patch('/:id/read', authenticate, ctrl.markAsRead);
router.patch('/:id/archive', authenticate, ctrl.archiveConversation);

module.exports = router;
