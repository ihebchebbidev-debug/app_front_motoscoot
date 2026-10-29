const router = require('express').Router();
const { authenticate, requireAdmin, optionalAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/articlesController');
const extra = require('../controllers/articlesExtraController');

router.get('/', ctrl.getAll);
router.get('/featured', extra.getFeatured);
router.get('/categories', extra.getCategories);
router.get('/:slug', ctrl.getBySlug);
router.get('/:slug/related', extra.getRelated);
router.get('/:slug/comments', extra.getComments);
router.post('/:slug/view', optionalAuth, extra.trackView);
router.post('/:slug/like', authenticate, extra.toggleLike);
router.post('/:slug/comments', authenticate, extra.addComment);
router.delete('/comments/:commentId', authenticate, extra.deleteComment);
router.post('/', authenticate, requireAdmin, ctrl.create);
router.put('/:id', authenticate, requireAdmin, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
