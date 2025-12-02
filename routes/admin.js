const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const uploadController = require('../controllers/uploadController');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(ensureAuthenticated);
router.use(ensureAdmin);

router.get('/', adminController.getDashboard);
router.get('/info', adminController.getInfo);

// Upload Manager
router.get('/uploads', uploadController.getUploads);
router.post('/uploads', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.redirect('/admin/uploads?error=' + encodeURIComponent(err.message));
        }
        next();
    });
}, uploadController.postUpload);
router.delete('/uploads/:filename', uploadController.deleteUpload);

// Page Content Editors
router.get('/page/:page', adminController.getEditPage);
router.post('/page/:page', upload.single('image'), adminController.postEditPage);

// Leader CRUD
router.get('/leaders', adminController.getLeaders);
router.post('/leaders', upload.single('image'), adminController.postLeader);
router.delete('/leaders/:id', adminController.deleteLeader);

// Event CRUD
router.get('/events', adminController.getEvents);
router.post('/events', adminController.postEvent);
router.delete('/events/:id', adminController.deleteEvent);

module.exports = router;