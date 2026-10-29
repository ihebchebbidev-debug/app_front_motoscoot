const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/reportsController');

router.post('/', authenticate, ctrl.create);
router.get('/my', authenticate, ctrl.getMyReports);

module.exports = router;
