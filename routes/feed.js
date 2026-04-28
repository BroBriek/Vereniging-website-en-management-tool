const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const { ensureAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/feedUpload');
const { compressFeedImage } = require('../middleware/imageCompression');

router.use(ensureAuthenticated);

router.get('/api/users', feedController.searchUsers);
router.get('/calendar', feedController.getCalendar);
router.get('/', feedController.getFeed);
router.get('/group/:slug', feedController.getFeed);
router.get('/group/:slug/files', feedController.getGroupFiles);
router.post('/group/create-event', upload.single('bannerImage'), compressFeedImage, feedController.postCreateEvent);
router.post('/group/:id/update', upload.single('bannerImage'), compressFeedImage, feedController.postUpdateEvent);
router.post('/group/:id/delete', feedController.postDeleteEvent);
router.post('/post', upload.array('attachments'), compressFeedImage, feedController.postCreatePost);
router.post('/post/:id/update', upload.array('attachments'), compressFeedImage, feedController.updatePost);
router.post('/post/:id/delete', feedController.deletePost);
router.post('/post/:id/like', feedController.toggleLike);
router.post('/comment', feedController.postComment);
router.post('/comment/:id/like', feedController.toggleCommentLike);
router.post('/comment/:id/update', feedController.updateComment);
router.post('/comment/:id/delete', feedController.deleteComment);
router.post('/api/fix-image', feedController.fixImageApi);
router.post('/respond', feedController.postResponse);

module.exports = router;
