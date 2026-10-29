const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { upload, uploadSingle, uploadMultiple, deleteFile } = require('../controllers/uploadController');

router.post('/single', authenticate, upload.single('file'), uploadSingle);
router.post('/multiple', authenticate, upload.array('files', 10), uploadMultiple);
router.delete('/:filename', authenticate, deleteFile);

module.exports = router;
