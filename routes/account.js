const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { ensureAuthenticated } = require('../middleware/auth');

// Protect all routes
router.use(ensureAuthenticated);

router.get('/settings', accountController.getSettings);
router.post('/password', accountController.updatePassword);
router.post('/subscribe', accountController.subscribePush);
router.post('/email', accountController.updateEmail);
router.get('/email/verify/:token', accountController.verifyEmail);
router.post('/email-toggle', accountController.toggleEmailNotifications);

module.exports = router;
