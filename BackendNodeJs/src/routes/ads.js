const router = require('express').Router();
const { optionalAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/adsPublicController');

router.get('/active', ctrl.getActive);
router.post('/:id/impression', optionalAuth, ctrl.trackImpression);
router.post('/:id/click', optionalAuth, ctrl.trackClick);

module.exports = router;
