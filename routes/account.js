const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { ensureAuthenticated } = require('../middleware/auth');
const profileUpload = require('../middleware/profileUpload');
const { compressProfilePicture } = require('../middleware/imageCompression');

// Protect all routes
router.use(ensureAuthenticated);

router.get('/settings', accountController.getSettings);
router.post('/password', accountController.updatePassword);
router.post('/subscribe', accountController.subscribePush);
router.post('/unsubscribe', accountController.unsubscribePush);
router.post('/email', accountController.updateEmail);
router.get('/email/verify/:token', accountController.verifyEmail);
router.post('/email-toggle', accountController.toggleEmailNotifications);
router.post('/profile-picture', profileUpload.single('profilePicture'), compressProfilePicture, accountController.uploadProfilePicture);
router.post('/profile-picture/delete', accountController.deleteProfilePicture);
router.post('/notifications/preferences', accountController.updateNotificationPreferences);
router.post('/secondary-account', accountController.updateSecondaryAccount);
router.get('/switch', accountController.switchAccount);

module.exports = router;
