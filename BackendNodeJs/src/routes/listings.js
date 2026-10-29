const router = require('express').Router();
const { authenticate, optionalAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/listingsController');
const extra = require('../controllers/listingsExtraController');
const { upload, uploadMultiple } = require('../controllers/uploadController');

// Static / collection routes (must come before /:id)
router.get('/popular', extra.getPopular);
router.get('/facets', ctrl.getFacets);
router.get('/suggestions', extra.getSuggestions);
router.get('/favorites', authenticate, ctrl.getFavorites);
router.get('/drafts', authenticate, extra.getDrafts);
router.post('/estimate-price', extra.estimatePrice);
// optionalAuth so the owner can see their full inventory (drafts, pending,
// rejected) while anonymous viewers only get active listings.
router.get('/user/:userId', optionalAuth, ctrl.getByUser);

// Listing-specific
router.get('/:id/similar', extra.getSimilar);
router.get('/:id/stats', authenticate, extra.getStats);
// optionalAuth so the controller can see req.user for owner-skip on view
// counting and for PII gating decisions, without blocking anonymous viewers.
router.get('/:id', optionalAuth, ctrl.getById);
router.post('/', authenticate, ctrl.create);
router.put('/:id', authenticate, ctrl.update);
router.patch('/:id/status', authenticate, extra.setStatus);
router.delete('/:id', authenticate, ctrl.remove);
router.post('/:id/favorite', authenticate, ctrl.toggleFavorite);
router.post('/:id/contact', optionalAuth, extra.trackContact);
router.post('/:id/share', optionalAuth, extra.trackShare);
router.post('/:id/boost', authenticate, extra.boost);
router.use('/:id/call-request', require('./callRequests'));
router.post('/:id/images', authenticate, upload.array('images', 10), uploadMultiple);

router.get('/', ctrl.getAll);

module.exports = router;
