const router = require('express').Router();
const { authenticate, requireAdmin, optionalAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/tipsController');
const extra = require('../controllers/tipsExtraController');

router.get('/', ctrl.getAll);
router.get('/featured', extra.getFeatured);
router.get('/categories', extra.getCategories);
router.get('/bookmarks', authenticate, extra.getBookmarks);
router.get('/:slug', ctrl.getBySlug);
router.get('/:slug/related', extra.getRelated);
router.post('/:slug/view', optionalAuth, extra.trackView);
router.post('/:slug/like', authenticate, extra.toggleLike);
router.post('/:slug/bookmark', authenticate, extra.toggleBookmark);
router.post('/', authenticate, requireAdmin, ctrl.create);
router.put('/:id', authenticate, requireAdmin, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
