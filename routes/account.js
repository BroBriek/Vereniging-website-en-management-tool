const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { ensureAuthenticated } = require('../middleware/auth');

// Protect all routes
router.use(ensureAuthenticated);

router.get('/settings', accountController.getSettings);
router.post('/password', accountController.updatePassword);
router.post('/subscribe', accountController.subscribePush);

module.exports = router;