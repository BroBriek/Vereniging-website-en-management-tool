const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { ensureAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/gameUpload');

router.get('/', ensureAuthenticated, gameController.getGames);
router.get('/add', ensureAuthenticated, gameController.getAddGame);
router.post('/add', ensureAuthenticated, upload.array('attachments'), gameController.postAddGame);
router.get('/:id', ensureAuthenticated, gameController.getGame);
router.get('/:id/edit', ensureAuthenticated, gameController.getEditGame);
router.post('/:id/edit', ensureAuthenticated, upload.array('attachments'), gameController.postEditGame);
router.post('/:id/delete', ensureAuthenticated, gameController.postDeleteGame);

module.exports = router;
