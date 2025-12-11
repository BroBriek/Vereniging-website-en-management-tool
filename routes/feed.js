const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const { ensureAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/feedUpload');

router.use(ensureAuthenticated);

router.get('/api/users', feedController.searchUsers);
router.get('/', feedController.getFeed);
router.get('/group/:slug', feedController.getFeed);
router.get('/group/:slug/files', feedController.getGroupFiles);
router.post('/post', upload.array('attachments'), feedController.postCreatePost);
router.post('/post/:id/update', feedController.updatePost);
router.post('/post/:id/delete', feedController.deletePost);
router.post('/post/:id/like', feedController.toggleLike);
router.post('/comment', feedController.postComment);
router.post('/comment/:id/update', feedController.updateComment);
router.post('/comment/:id/delete', feedController.deleteComment);
router.post('/respond', feedController.postResponse);

module.exports = router;
