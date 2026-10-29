const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/garagesController');
const extra = require('../controllers/garagesExtraController');

router.get('/popular', extra.getPopular);
router.get('/nearby', extra.getNearby);
router.get('/specialties', extra.getSpecialties);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.get('/:id/reviews', extra.getReviews);
router.post('/', authenticate, ctrl.create);
router.put('/:id', authenticate, ctrl.update);
router.delete('/:id', authenticate, ctrl.remove);
router.post('/:id/reviews', authenticate, ctrl.addReview);
router.patch('/:id/reviews/:reviewId/reply', authenticate, extra.replyToReview);
router.patch('/:id/reviews/:reviewId/helpful', authenticate, extra.markHelpful);
router.delete('/:id/reviews/:reviewId', authenticate, extra.deleteReview);

module.exports = router;
