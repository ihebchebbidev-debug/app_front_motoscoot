const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/siteReviewsController');

router.get('/', ctrl.getAll);
router.get('/summary', ctrl.getSummary);
router.post('/', authenticate, ctrl.create);
router.patch('/:id/publish', authenticate, requireAdmin, ctrl.adminPublish);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
