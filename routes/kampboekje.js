const express = require('express');
const router = express.Router();
const kampboekjeController = require('../controllers/kampboekjeController');
const { ensureAuthenticated, ensureKookmoekeOrAdmin } = require('../middleware/auth');
const upload = require('../middleware/feedUpload');
const { compressFeedImage } = require('../middleware/imageCompression');

router.use(ensureAuthenticated);
router.use(ensureKookmoekeOrAdmin);

router.get('/', kampboekjeController.getEntries);
router.post('/create', upload.array('images', 10), compressFeedImage, kampboekjeController.createEntry);
router.post('/:id/update', upload.array('images', 10), compressFeedImage, kampboekjeController.updateEntry);
router.post('/:id/delete', kampboekjeController.deleteEntry);
router.post('/:id/pin', kampboekjeController.togglePin);

module.exports = router;
