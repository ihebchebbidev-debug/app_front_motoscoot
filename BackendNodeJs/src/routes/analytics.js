const router = require('express').Router();
const { authenticate, optionalAuth, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/analyticsController');

// --- Public ingestion (called by the frontend tracker) ---
router.post('/sessions',         optionalAuth, ctrl.createSession);
router.patch('/sessions/:id',    optionalAuth, ctrl.updateSession);
// POST alias for navigator.sendBeacon (which only supports POST)
router.post('/sessions/:id',     optionalAuth, ctrl.updateSession);
router.post('/page-view',        optionalAuth, ctrl.trackPageView);
router.post('/listing-view',     optionalAuth, ctrl.trackListingView);
router.post('/listing-click',    optionalAuth, ctrl.trackListingClick);
router.post('/listing-event',    optionalAuth, ctrl.trackListingEvent);

// --- Admin only ---
router.get('/dashboard', authenticate, requireAdmin, ctrl.getDashboard);
router.get('/audience',         authenticate, requireAdmin, ctrl.getAudience);
router.get('/funnel',           authenticate, requireAdmin, ctrl.getFunnel);
router.get('/funnel/by-source', authenticate, requireAdmin, ctrl.getFunnelBySource);
router.get('/visitors',         authenticate, requireAdmin, ctrl.listVisitors);
router.get('/visitors/:fingerprint', authenticate, requireAdmin, ctrl.getVisitor);

module.exports = router;
