const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const { ensureAuthenticated } = require('../middleware/auth');

router.use(ensureAuthenticated);

router.get('/', quoteController.getQuotes);
router.post('/', quoteController.createQuote);
router.post('/:id/delete', quoteController.deleteQuote);
router.post('/delete-all', quoteController.deleteAllQuotes);

module.exports = router;
