const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/faqController');

router.get('/', ctrl.getAll);
router.post('/', authenticate, requireAdmin, ctrl.create);
router.put('/:id', authenticate, requireAdmin, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
