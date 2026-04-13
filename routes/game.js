const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { ensureAuthenticated, ensureGameAccess } = require('../middleware/auth');
const upload = require('../middleware/gameUpload');

router.get('/', ensureAuthenticated, ensureGameAccess, gameController.getGames);
router.get('/add', ensureAuthenticated, ensureGameAccess, gameController.getAddGame);
router.post('/add', ensureAuthenticated, ensureGameAccess, upload.array('attachments'), gameController.postAddGame);
router.get('/:id', ensureAuthenticated, ensureGameAccess, gameController.getGame);
router.get('/:id/edit', ensureAuthenticated, ensureGameAccess, gameController.getEditGame);
router.post('/:id/edit', ensureAuthenticated, ensureGameAccess, upload.array('attachments'), gameController.postEditGame);
router.post('/:id/delete', ensureAuthenticated, ensureGameAccess, gameController.postDeleteGame);

module.exports = router;
