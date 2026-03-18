const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const formController = require('../controllers/formController');

router.get('/', publicController.getHome);
router.get('/home', publicController.getPublicHome);
router.get('/praktisch', publicController.getPractical);
router.get('/leiding', publicController.getLeaders);
router.get('/kalender', publicController.getCalendar);
router.get('/kalender/hulp', publicController.getCalendarHelp);
router.get('/kalender/subscribe.ics', publicController.getCalendarICS);
router.get('/afdelingen', publicController.getDepartments);
router.get('/t-shirts', publicController.getShirts);
router.get('/inschrijven', publicController.getRegister);
router.post('/inschrijven', publicController.postRegister);
router.get('/contact', publicController.getContact);
router.post('/contact', publicController.postContact);
router.get('/help', publicController.getHelp);
router.get('/download', publicController.downloadFile);
router.get('/robots.txt', publicController.getRobotsTxt);
router.get('/sitemap.xml', publicController.getSitemapXml);

// Public Forms
router.get('/forms/:slug', formController.getPublicForm);
router.post('/forms/:slug/submit', formController.postSubmitForm);

module.exports = router;
