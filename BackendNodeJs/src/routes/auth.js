const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/authController');
const extra = require('../controllers/authExtraController');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.post('/refresh-token', authenticate, ctrl.refreshToken);
router.get('/me', authenticate, ctrl.getMe);

// Extra auth (Clerk / verification / logout)
router.post('/check-email', extra.checkEmail);
router.post('/verify-email', extra.verifyEmail);
router.post('/resend-verification', authenticate, extra.resendVerification);
router.post('/clerk', extra.clerkSync);
router.post('/logout', authenticate, extra.logout);

module.exports = router;
