const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const formController = require('../controllers/formController');
const customPageController = require('../controllers/customPageController');
const SettingsService = require('../services/SettingsService');

const checkVisibility = (path) => {
    return (req, res, next) => {
        const hiddenPages = (SettingsService.get('hidden_nav_pages') || '').split(',').map(p => p.trim()).filter(p => p);
        if (hiddenPages.includes(path)) {
            return res.status(404).render('error', { 
                title: 'Pagina Niet Beschikbaar',
                status: 404,
                message: 'Deze pagina is momenteel niet beschikbaar.', 
                description: 'Deze pagina is door de beheerder tijdelijk uitgeschakeld.',
                user: req.user 
            });
        }
        next();
    };
};

router.get('/', checkVisibility('/home'), publicController.getHome);
router.get('/home', checkVisibility('/home'), publicController.getPublicHome);
router.get('/praktisch', checkVisibility('/praktisch'), publicController.getPractical);
router.get('/leiding', checkVisibility('/leiding'), publicController.getLeaders);
router.get('/kalender', checkVisibility('/kalender'), publicController.getCalendar);
router.get('/kalender/hulp', publicController.getCalendarHelp);
router.get('/kalender/subscribe.ics', publicController.getCalendarICS);
router.get('/afdelingen', checkVisibility('/afdelingen'), publicController.getDepartments);
router.get('/t-shirts', checkVisibility('/t-shirts'), publicController.getShirts);
router.get('/inschrijven', checkVisibility('/inschrijven'), publicController.getRegister);
router.post('/inschrijven', checkVisibility('/inschrijven'), publicController.postRegister);
router.get('/contact', checkVisibility('/contact'), publicController.getContact);
router.post('/contact', checkVisibility('/contact'), publicController.postContact);
router.get('/help', publicController.getHelp);
router.get('/download', publicController.downloadFile);
router.get('/robots.txt', publicController.getRobotsTxt);
router.get('/sitemap.xml', publicController.getSitemapXml);
router.get('/manifest.json', publicController.getManifestJson);

// Public Forms
router.get('/forms/:slug', formController.getPublicForm);
router.post('/forms/:slug/submit', formController.postSubmitForm);

// Custom Pages
router.get('/p/:slug', customPageController.getPublicPage);

module.exports = router;
