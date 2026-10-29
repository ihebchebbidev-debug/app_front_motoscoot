const router = require('express').Router();
const ctrl = require('../controllers/siteSettingsController');
const seoCtrl = require('../controllers/seoSettingsController');

// Public read — consumed by the Hero component on every page load.
router.get('/hero', ctrl.getHero);
router.get('/hero-texts', ctrl.getHeroTexts);
router.get('/app-background', ctrl.getAppBackground);
router.get('/social-links', ctrl.getSocialLinks);
// Public read — consumed by SEO.tsx and the GA4 loader. Strips secrets.
router.get('/seo', seoCtrl.getPublic);
// Public dynamic robots.txt (merges admin `robots_extra`).
router.get('/robots.txt', seoCtrl.getRobots);

module.exports = router;
