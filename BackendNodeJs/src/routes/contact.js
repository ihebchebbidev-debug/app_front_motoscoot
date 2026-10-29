const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/contactController');

router.post('/', ctrl.send);
router.get('/', authenticate, requireAdmin, ctrl.adminList);
router.patch('/:id/resolve', authenticate, requireAdmin, ctrl.adminResolve);

module.exports = router;
