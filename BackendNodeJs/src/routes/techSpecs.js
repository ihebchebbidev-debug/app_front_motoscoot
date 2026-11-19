const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/techSpecsController');
const extra = require('../controllers/techSpecsExtraController');
const leads = require('../controllers/techSpecLeadsController');

router.get('/brands', ctrl.getBrands);
router.get('/brands/:brand', ctrl.getModels);
router.get('/categories', extra.getCategories);
router.get('/popular', extra.getPopular);
router.get('/latest', extra.getLatest);
router.get('/search', extra.searchAll);
router.post('/compare', extra.compare);
router.get('/:id', ctrl.getById);
router.post('/:id/visit', extra.trackVisit);
// « Demande de devis » and taps on Appel / WhatsApp / Comparer (importer counters).
router.post('/:id/quote', leads.requestQuote);
router.post('/:id/lead', leads.trackLead);
router.post('/', authenticate, requireAdmin, ctrl.create);
router.put('/:id', authenticate, requireAdmin, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
