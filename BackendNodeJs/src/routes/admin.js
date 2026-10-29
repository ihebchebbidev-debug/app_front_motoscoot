const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/adminController');
const { upload, uploadSingle } = require('../controllers/uploadController');

router.use(authenticate, requireAdmin);

// Dashboard
router.get('/stats', ctrl.getDashboardStats);

// Users
router.get('/users', ctrl.getUsers);
router.patch('/users/:id/role', ctrl.setUserRole);
router.delete('/users/:id/role', ctrl.removeUserRole);
router.patch('/users/:id/ban', ctrl.banUser);
// Set/remove a client's profile photo (file itself goes through /api/uploads).
router.patch('/users/:id/avatar', ctrl.setUserAvatar);
router.delete('/users/:id', ctrl.deleteUser);

// Listings moderation
router.get('/listings', ctrl.getAllListings);
router.get('/listings/pending', ctrl.getPendingListings);
router.patch('/listings/:id/moderate', ctrl.moderateListing);
// Hard-delete a listing (admin only). Reuses the listings controller which
// already permits admin deletion of any listing and writes an audit entry.
const listingsCtrl = require('../controllers/listingsController');
router.delete('/listings/:id', listingsCtrl.remove);

// Boost lifecycle — manual trigger of the periodic sweep that flips
// listings.is_featured back to FALSE when listing_boosts.ends_at has passed.
const listingsExtra = require('../controllers/listingsExtraController');
router.post('/boosts/expire', listingsExtra.expireBoostsNow);

// Site reviews moderation
const siteReviewsCtrl = require('../controllers/siteReviewsController');
router.get('/site-reviews', ctrl.getSiteReviewsForModeration);
router.post('/site-reviews', siteReviewsCtrl.adminCreate);
router.patch('/site-reviews/:id/publish', siteReviewsCtrl.adminPublish);
router.delete('/site-reviews/:id', siteReviewsCtrl.remove);

// Garages admin
router.get('/garages', ctrl.getAllGarages);
router.post('/garages', ctrl.createGarageAsAdmin);
router.patch('/garages/:id/verify', ctrl.setGarageVerified);

// Reports
router.get('/reports', ctrl.getReports);
router.patch('/reports/:id/resolve', ctrl.resolveReport);

// Ad campaigns
router.get('/ad-campaigns', ctrl.getAdCampaigns);
router.post('/ad-campaigns', ctrl.createAdCampaign);
router.get('/ad-campaigns/:id/analytics', ctrl.getAdCampaignAnalytics);
router.patch('/ad-campaigns/:id', ctrl.updateAdCampaign);
router.delete('/ad-campaigns/:id', ctrl.deleteAdCampaign);

// Admin file upload
router.post('/upload', upload.single('file'), uploadSingle);

// Contact messages (admin moderation)
const contactCtrl = require('../controllers/contactController');
router.get('/contact-messages', contactCtrl.adminList);
router.patch('/contact-messages/:id/resolve', contactCtrl.adminResolve);

// FAQ admin (full CRUD)
const faqCtrl = require('../controllers/faqController');
router.get('/faqs', faqCtrl.getAll);
router.post('/faqs', faqCtrl.create);
router.put('/faqs/:id', faqCtrl.update);
router.delete('/faqs/:id', faqCtrl.remove);

// Newsletter subscribers (admin)
const newsletterCtrl = require('../controllers/newsletterController');
router.get('/newsletter', newsletterCtrl.adminList);
router.delete('/newsletter/:id', newsletterCtrl.adminRemove);
router.use('/newsletter', require('./adminNewsletterBroadcast'));

// Reference data CRUD (brands, models, cities, categories, etc.)
const ref = require('../controllers/adminReferenceController');

// Brands
router.get   ('/reference/brands',     ref.listBrands);
router.post  ('/reference/brands',     ref.createBrand);
router.patch ('/reference/brands/:id', ref.updateBrand);
router.delete('/reference/brands/:id', ref.deleteBrand);

// Models
router.get   ('/reference/models',     ref.listModels);
router.post  ('/reference/models',     ref.createModel);
router.patch ('/reference/models/:id', ref.updateModel);
router.delete('/reference/models/:id', ref.deleteModel);

// Cities
router.get   ('/reference/cities',     ref.listCities);
router.post  ('/reference/cities',     ref.createCity);
router.patch ('/reference/cities/:id', ref.updateCity);
router.delete('/reference/cities/:id', ref.deleteCity);

// Vehicle categories
router.get   ('/reference/vehicle-categories',     ref.vehicleCategories.list);
router.post  ('/reference/vehicle-categories',     ref.vehicleCategories.create);
router.patch ('/reference/vehicle-categories/:id', ref.vehicleCategories.update);
router.delete('/reference/vehicle-categories/:id', ref.vehicleCategories.remove);

// Accessory types
router.get   ('/reference/accessory-types',     ref.accessoryTypes.list);
router.post  ('/reference/accessory-types',     ref.accessoryTypes.create);
router.patch ('/reference/accessory-types/:id', ref.accessoryTypes.update);
router.delete('/reference/accessory-types/:id', ref.accessoryTypes.remove);

// Garage specialties
router.get   ('/reference/garage-specialties',     ref.garageSpecialties.list);
router.post  ('/reference/garage-specialties',     ref.garageSpecialties.create);
router.patch ('/reference/garage-specialties/:id', ref.garageSpecialties.update);
router.delete('/reference/garage-specialties/:id', ref.garageSpecialties.remove);

// Garage services catalog
router.get   ('/reference/garage-services',     ref.garageServices.list);
router.post  ('/reference/garage-services',     ref.garageServices.create);
router.patch ('/reference/garage-services/:id', ref.garageServices.update);
router.delete('/reference/garage-services/:id', ref.garageServices.remove);

// Equipment
router.get   ('/reference/equipment',     ref.listEquipment);
router.post  ('/reference/equipment',     ref.createEquipment);
router.patch ('/reference/equipment/:id', ref.updateEquipment);
router.delete('/reference/equipment/:id', ref.deleteEquipment);

// Colors
router.get   ('/reference/colors',     ref.listColors);
router.post  ('/reference/colors',     ref.createColor);
router.patch ('/reference/colors/:id', ref.updateColor);
router.delete('/reference/colors/:id', ref.deleteColor);

// Brand visit trends (community-popular brands over time)
const adminBrands = require('../controllers/adminBrandsController');
router.get('/brand-trends', adminBrands.getBrandTrends);
router.get('/brand-trends/:brand/models', adminBrands.getBrandModelsBreakdown);

// Articles (actualités) — admin list incl. drafts; CRUD reuses public controller
const articlesCtrl = require('../controllers/articlesController');
const adminContent = require('../controllers/adminContentController');
router.get   ('/articles',     adminContent.listArticles);
router.post  ('/articles',     articlesCtrl.create);
router.put   ('/articles/:id', articlesCtrl.update);
router.delete('/articles/:id', articlesCtrl.remove);

// Tech specs (fiches techniques) — admin list + CRUD
const techSpecsCtrl = require('../controllers/techSpecsController');
router.get   ('/tech-specs',     adminContent.listTechSpecs);
router.post  ('/tech-specs',     techSpecsCtrl.create);
router.put   ('/tech-specs/:id', techSpecsCtrl.update);
router.delete('/tech-specs/:id', techSpecsCtrl.remove);

// Importateurs (catalog of brand importers/distributors). Public read
// happens via /importers; admin CRUD lives here under /admin/importers.
const importersCtrl = require('../controllers/importersController');
router.get   ('/importers',      importersCtrl.list);
router.get   ('/importers/:id',  importersCtrl.getById);
router.post  ('/importers',      importersCtrl.create);
router.put   ('/importers/:id',  importersCtrl.update);
router.delete('/importers/:id',  importersCtrl.remove);

// Tips (conseils) — admin list incl. drafts; CRUD reuses public controller
const tipsCtrl = require('../controllers/tipsController');
router.get   ('/tips',     adminContent.listTips);
router.post  ('/tips',     tipsCtrl.create);
router.put   ('/tips/:id', tipsCtrl.update);
router.delete('/tips/:id', tipsCtrl.remove);

// Site settings (hero images on the landing page, etc.)
const siteSettings = require('../controllers/siteSettingsController');
router.get('/site-settings/hero', siteSettings.getHero);
router.put('/site-settings/hero', siteSettings.updateHero);
router.get('/site-settings/hero-texts', siteSettings.getHeroTexts);
router.put('/site-settings/hero-texts', siteSettings.updateHeroTexts);
router.get('/site-settings/app-background', siteSettings.getAppBackground);
router.put('/site-settings/app-background', siteSettings.updateAppBackground);
router.get('/site-settings/social-links', siteSettings.getSocialLinks);
router.put('/site-settings/social-links', siteSettings.updateSocialLinks);

// SEO + analytics settings (admin-managed; powers GA4, GSC, default meta).
const seoCtrl = require('../controllers/seoSettingsController');
router.get ('/site-settings/seo',    seoCtrl.getAdmin);
router.put ('/site-settings/seo',    seoCtrl.update);
router.post('/seo/ga4-report',       seoCtrl.ga4Report);
router.post('/seo/gsc-report',       seoCtrl.gscReport);
router.get ('/seo/test-credentials', seoCtrl.testCredentials);
router.get ('/seo/robots-preview',   seoCtrl.previewRobots);

// Developer tickets — internal bug/feature request board between admins
// and the developer. Only accessible by admins.
const devTicketsCtrl = require('../controllers/devTicketsController');
router.get   ('/dev-tickets',             devTicketsCtrl.list);
router.post  ('/dev-tickets',             devTicketsCtrl.create);
router.patch ('/dev-tickets/:id',         devTicketsCtrl.update);
router.patch ('/dev-tickets/:id/status',  devTicketsCtrl.updateStatus);
router.delete('/dev-tickets/:id',         devTicketsCtrl.remove);

module.exports = router;
