const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const { ensureAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/feedUpload');

router.use(ensureAuthenticated);

router.get('/', feedController.getFeed);
router.post('/post', upload.array('attachments'), feedController.postCreatePost);
router.post('/post/:id/update', feedController.updatePost);
router.post('/post/:id/delete', feedController.deletePost);
router.post('/comment', feedController.postComment);
router.post('/respond', feedController.postResponse);

module.exports = router;
