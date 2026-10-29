const router = require('express').Router();
const { authenticate, optionalAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/usersController');
const extra = require('../controllers/usersExtraController');
const { upload } = require('../controllers/uploadController');

router.get('/me/stats', authenticate, extra.getMyStats);
router.get('/me/blocked', authenticate, extra.getBlockedUsers);

// Explicit /me handler — must come BEFORE the catch-all /:id route so
// `/users/me` is never interpreted as `id = "me"` (which would crash the
// integer cast in `getProfile`).
router.get('/me', authenticate, async (req, res, next) => {
  // Re-use the same query as getProfile but keyed on the JWT user id.
  req.params.id = String(req.user.id);
  return ctrl.getProfile(req, res, next);
});

router.put('/profile', authenticate, ctrl.updateProfile);
router.put('/password', authenticate, ctrl.changePassword);
router.delete('/account', authenticate, ctrl.deleteAccount);
// Modern alias used by the dashboard "Delete my account" flow.
router.delete('/me', authenticate, ctrl.deleteAccount);
router.post('/avatar', authenticate, upload.single('avatar'), ctrl.uploadAvatar);
router.post('/:id/block', authenticate, extra.blockUser);
router.delete('/:id/block', authenticate, extra.unblockUser);
// optionalAuth so PII gating can identify owner / admin / conversation peer
// while still serving anonymous public profile views.
router.get('/:id', optionalAuth, ctrl.getProfile);

module.exports = router;
