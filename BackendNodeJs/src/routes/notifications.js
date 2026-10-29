const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/notificationsController');

router.get('/', authenticate, ctrl.getAll);
router.get('/unread-count', authenticate, ctrl.getUnreadCount);
router.patch('/read-all', authenticate, ctrl.markAllRead);
router.patch('/:id/read', authenticate, ctrl.markRead);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
