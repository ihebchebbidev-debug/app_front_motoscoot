/**
 * Public read-only access to the importers catalog. Admin CRUD lives
 * under /admin/importers.
 */
const router = require('express').Router();
const ctrl = require('../controllers/importersController');

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

module.exports = router;