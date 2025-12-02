const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/', publicController.getHome);
router.get('/praktisch', publicController.getPractical);
router.get('/leiding', publicController.getLeaders);
router.get('/kalender', publicController.getCalendar);
router.get('/afdelingen', publicController.getDepartments);
router.get('/t-shirts', publicController.getShirts);
router.get('/contact', publicController.getContact);
router.post('/contact', publicController.postContact);

module.exports = router;