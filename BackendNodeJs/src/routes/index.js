const router = require('express').Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Route modules
router.use('/auth', require('./auth'));
router.use('/listings', require('./listings'));
router.use('/users', require('./users'));
router.use('/conversations', require('./conversations'));
router.use('/garages', require('./garages'));
router.use('/articles', require('./articles'));
router.use('/tips', require('./tips'));
router.use('/tech-specs', require('./techSpecs'));
router.use('/analytics', require('./analytics'));
router.use('/admin', require('./admin'));
router.use('/uploads', require('./uploads'));
router.use('/reports', require('./reports'));
router.use('/reference', require('./reference'));
router.use('/newsletter', require('./newsletter'));
router.use('/tests', require('./tests'));

// New modules
router.use('/notifications', require('./notifications'));
router.use('/saved-searches', require('./savedSearches'));
router.use('/site-reviews', require('./siteReviews'));
router.use('/contact', require('./contact'));
router.use('/faq', require('./faq'));
router.use('/ads', require('./ads'));
router.use('/brands', require('./brands'));
router.use('/site-settings', require('./siteSettings'));
router.use('/importers', require('./importers'));

// Sitemap mounted at the API root → /api/sitemap.xml (referenced from public/robots.txt).
router.use('/', require('./sitemap'));

// Dynamic robots.txt alias → /api/robots.txt (merges admin `robots_extra`).
router.get('/robots.txt', require('../controllers/seoSettingsController').getRobots);

module.exports = router;
