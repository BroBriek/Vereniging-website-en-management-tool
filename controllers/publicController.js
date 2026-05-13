const { PageContent, Leader, Event, Registration, User, CalendarAccess, SystemState } = require('../models');
const { Op } = require('sequelize');
const ics = require('ics');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PhoneService = require('../services/PhoneService');

const getContent = async (slug) => {
    try {
        const contents = await PageContent.findAll({ where: { slug } });
        const map = {};
        contents.forEach(c => map[c.section_key] = c);
        return map;
    } catch (e) {
        return {};
    }
};

exports.getCalendarICS = async (req, res) => {
    try {
        const { token } = req.query;
        let whereClause = { isPrivate: false };
        let calName = 'Chiro Vreugdeland';
        let foundUserId = null;

        if (token) {
            const user = await User.findOne({ where: { calendarToken: token, isActive: true } });
            if (user) {
                whereClause = {}; // All events
                calName = `Chiro Leidingskalender (${user.username})`;
                foundUserId = user.id;
            }
        }

        // Log the access (in background to not slow down response)
        CalendarAccess.create({
            userId: foundUserId,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip || req.connection.remoteAddress
        }).catch(err => console.error('Error logging calendar access:', err));

        const events = await Event.findAll({
            where: whereClause,
            order: [['date', 'ASC']]
        });

        const icsEvents = events.map(event => {
            const [y, m, d] = event.date.split('-').map(Number);
            
            let start, end;
            let startInputType = 'utc';
            let endInputType = 'utc';

            if (event.startTime) {
                const [h, min] = event.startTime.split(':').map(Number);
                start = [y, m, d, h, min];
                startInputType = 'local';

                const [ey, em, ed] = (event.endDate || event.date).split('-').map(Number);
                if (event.endTime) {
                    const [eh, emin] = event.endTime.split(':').map(Number);
                    end = [ey, em, ed, eh, emin];
                } else {
                    // Default to same time on endDate if multi-day, or 1 hour later if same day
                    if (event.endDate && event.endDate !== event.date) {
                        end = [ey, em, ed, h, min];
                    } else {
                        const startDateObj = new Date(y, m - 1, d, h, min);
                        startDateObj.setHours(startDateObj.getHours() + 1);
                        end = [
                            startDateObj.getFullYear(),
                            startDateObj.getMonth() + 1,
                            startDateObj.getDate(),
                            startDateObj.getHours(),
                            startDateObj.getMinutes()
                        ];
                    }
                }
                endInputType = 'local';
            } else {
                // All-day event
                start = [y, m, d];
                const [ey, em, ed] = (event.endDate || event.date).split('-').map(Number);
                const endDateObj = new Date(Date.UTC(ey, em - 1, ed));
                endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
                
                end = [
                    endDateObj.getUTCFullYear(),
                    endDateObj.getUTCMonth() + 1,
                    endDateObj.getUTCDate()
                ];
            }

            // Strip HTML tags for calendar description
            const plainDescription = (event.description || '')
                .replace(/<[^>]*>?/gm, '') // Remove HTML tags
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim();

            return {
                start,
                end,
                startInputType,
                startOutputType: startInputType,
                endInputType,
                endOutputType: endInputType,
                title: event.title,
                description: plainDescription,
                categories: ['Chiro Vreugdeland'],
                productId: 'chiromeeuwen/ics'
            };
        });

        if (icsEvents.length === 0) {
            // Provide a dummy event if no events found to avoid empty calendar errors in some clients
            const now = new Date();
            const start = [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()];
            const endDateObj = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
            const end = [
                endDateObj.getUTCFullYear(),
                endDateObj.getUTCMonth() + 1,
                endDateObj.getUTCDate()
            ];

            icsEvents.push({
                start,
                end,
                title: 'Geen evenementen gepland',
                description: 'Er zijn momenteel geen evenementen gepland op de website.',
                productId: 'chiromeeuwen/ics'
            });
        }

        const { error, value } = ics.createEvents(icsEvents);

        if (error) {
            console.error('ICS creation error:', error);
            return res.status(500).send('Er ging iets mis bij het genereren van de kalender');
        }

        // Add X-WR-CALNAME for better identification in some apps
        const icsWithHeaders = value.replace('PRODID:', `X-WR-CALNAME:${calName}\r\nPRODID:`);

        res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'attachment; filename="chiromeeuwen_kalender.ics"',
            'Cache-Control': 'no-cache'
        });

        res.send(icsWithHeaders);
    } catch (error) {
        console.error('Error in getCalendarICS:', error);
        res.status(500).send('Er ging iets mis');
    }
};

exports.getHome = async (req, res) => {
    // If user is logged in, redirect to feed/leaders corner
    if (req.user) {
        return res.redirect('/feed');
    }

    try {
        const content = await getContent('home');
        res.render('public/home', { 
            title: 'Chiro Vreugdeland Meeuwen - Jeugdbeweging Meeuwen', 
            description: 'Chiro Vreugdeland Meeuwen: jeugdbeweging voor kinderen in Meeuwen. Elke zondag spelen, activiteiten, vriendschap en plezier. Word lid!',
            content 
        });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getPublicHome = async (req, res) => {
    try {
        const content = await getContent('home');
        res.render('public/home', { 
            title: 'Chiro Vreugdeland Meeuwen - Jeugdbeweging Meeuwen', 
            description: 'Chiro Vreugdeland Meeuwen: jeugdbeweging voor kinderen in Meeuwen. Elke zondag spelen, activiteiten, vriendschap en plezier. Word lid!',
            content 
        });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getPractical = async (req, res) => {
    try {
        const content = await getContent('practical');
        res.render('public/practical', { 
            title: 'Praktisch - Informatie Chiro Vreugdeland', 
            description: 'Praktische info over Chiro Vreugdeland: lidgeld, uniformen, uren, locatie en aanmelden. Alles wat je moet weten.',
            content 
        });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getLeaders = async (req, res) => {
    try {
        const leaders = await Leader.findAll({ order: [['group', 'ASC'], ['name', 'ASC']] });
        const groups = {};
        const groupOrder = ['Hoofdleiding', 'Ribbels', 'Speelclub', 'Rakwi\'s', 'Tito\'s', 'Keti\'s', 'Aspi\'s'];
        groupOrder.forEach(g => groups[g] = []);
        leaders.forEach(l => {
            if (!groups[l.group]) groups[l.group] = [];
            groups[l.group].push(l);
        });
        res.render('public/leaders', { 
            title: 'Onze Leiding - Chiro Vreugdeland Meeuwen', 
            description: 'Maak kennis met het team van vrijwilligers en jeugdleiders van Chiro Vreugdeland.',
            groups 
        });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getCalendar = async (req, res) => {
    if (req.user) {
        return res.redirect('/feed/calendar');
    }
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const events = await Event.findAll({ 
            where: {
                isPrivate: false,
                [Op.or]: [
                    { date: { [Op.gte]: today } },
                    { 
                        [Op.and]: [
                            { endDate: { [Op.ne]: null } },
                            { endDate: { [Op.gte]: today } }
                        ]
                    }
                ]
            },
            order: [['date', 'ASC']]
        });
        res.render('public/calendar', { 
            title: 'Kalender & Activiteiten - Chiro Vreugdeland', 
            description: 'De volledige kalender van Chiro Vreugdeland: mis geen activiteiten, zondagen of speciale evenementen.',
            events 
        });
    } catch (error) {
        console.error('Error in getCalendar:', error);
        res.status(500).send('Er ging iets mis');
    }
};

exports.getDepartments = async (req, res) => {
    try {
        const content = await getContent('departments');
        res.render('public/departments', { 
            title: 'Afdelingen - Chiro Vreugdeland Meeuwen', 
            description: 'Ontdek alle afdelingen van Chiro: Ribbels, Speelclub, Rakwi\'s, Tito\'s, Keti\'s en Aspi\'s. Vind jouw groep!',
            content 
        });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getShirts = async (req, res) => {
    try {
        const content = await getContent('shirts');
        res.render('public/shirts', { 
            title: 'T-Shirts & Merchandise - Chiro Vreugdeland', 
            description: 'Koop coole Chiro Vreugdeland T-shirts en merchandise. Bekijk maten, kleuren en prijzen.',
            content 
        });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getRegister = async (req, res) => {
    try {
        const content = await getContent('register');
        const regState = await SystemState.findOne({ where: { key: 'is_registration_open' } });
        const isRegistrationOpen = regState ? regState.value === 'true' : true;

        res.render('public/register', {
            title: 'Inschrijven bij Chiro Vreugdeland',
            description: 'Schrijf jezelf of je kind in voor het nieuwe Chirojaar. Alle groepen zijn welkom!',
            content,
            isRegistrationOpen
        });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.postRegister = async (req, res) => {
    const content = await getContent('register');
    const regState = await SystemState.findOne({ where: { key: 'is_registration_open' } });
    const isRegistrationOpen = regState ? regState.value === 'true' : true;
    
    try {
        if (!isRegistrationOpen) {
            return res.render('public/register', {
                title: 'Inschrijven bij Chiro Vreugdeland',
                description: 'De inschrijvingen zijn gesloten.',
                content,
                isRegistrationOpen,
                error: 'De inschrijvingsperiode is helaas gesloten.'
            });
        }

        const payload = {
            type: req.body.type === 'leiding' ? 'leiding' : 'lid',
            firstName: (req.body.firstName || '').trim(),
            lastName: (req.body.lastName || '').trim(),
            birthdate: req.body.birthdate,
            memberPhone: PhoneService.formatPhoneNumber(req.body.memberPhone),
            parentsNames: req.body.parentsNames || null,
            parentsPhone: PhoneService.formatPhoneNumber(req.body.parentsPhone),
            phone: PhoneService.formatPhoneNumber(req.body.phone),
            email: (req.body.email || '').trim(),
            photoPermission: req.body.photoPermission === 'on' || req.body.photoPermission === 'true',
            medicalInfo: req.body.medicalInfo || null,
            group: req.body.type === 'leiding' ? 'leiding' : (req.body.group || '').trim().toLowerCase(),
            privacyAccepted: req.body.privacyAccepted === 'on' || req.body.privacyAccepted === 'true'
        };

        // Basic validation for phone numbers if provided
        if (payload.parentsPhone && !PhoneService.isValidFormat(payload.parentsPhone)) {
             return res.render('public/register', {
                title: 'Inschrijven bij Chiro Vreugdeland',
                content,
                isRegistrationOpen,
                error: 'Het telefoonnummer van de ouders is ongeldig. Gebruik bijv. 0470 12 34 56.'
            });
        }
        if (payload.phone && !PhoneService.isValidFormat(payload.phone)) {
             return res.render('public/register', {
                title: 'Inschrijven bij Chiro Vreugdeland',
                content,
                isRegistrationOpen,
                error: 'Het telefoonnummer is ongeldig. Gebruik bijv. 0470 12 34 56.'
            });
        }
        if (payload.memberPhone && !PhoneService.isValidFormat(payload.memberPhone)) {
             return res.render('public/register', {
                title: 'Inschrijven bij Chiro Vreugdeland',
                content,
                isRegistrationOpen,
                error: 'Het telefoonnummer van het lid is ongeldig. Gebruik bijv. 0470 12 34 56.'
            });
        }
        const validGroups = ['ribbel', 'speelclub', 'rakwi', 'tito', 'keti', 'aspi', 'leiding'];
        if (!validGroups.includes(payload.group)) {
            console.warn(`Registration attempt with invalid group: "${payload.group}"`);
            return res.render('public/register', {
                title: 'Inschrijven bij Chiro Vreugdeland',
                description: 'Schrijf jezelf of je kind in voor het nieuwe Chirojaar. Alle groepen zijn welkom!',
                content,
                isRegistrationOpen,
                error: 'Selecteer een geldige groep.'
            });
        }

        if (!payload.firstName || !payload.lastName || !payload.birthdate || !payload.email || !payload.privacyAccepted) {
            return res.render('public/register', {
                title: 'Inschrijven bij Chiro Vreugdeland',
                description: 'Schrijf jezelf of je kind in voor het nieuwe Chirojaar. Alle groepen zijn welkom!',
                content,
                isRegistrationOpen,
                error: 'Vul alle verplichte velden in.'
            });
        }
        
        payload.period = await PeriodService.getCurrentPeriod();

        await Registration.create(payload);
        res.render('public/register', { 
            title: 'Inschrijven bij Chiro Vreugdeland', 
            description: 'Schrijf jezelf of je kind in voor het nieuwe Chirojaar. Alle groepen zijn welkom!',
            content, 
            isRegistrationOpen,
            success: 'Bedankt voor je inschrijving! We hebben de gegevens goed ontvangen.' 
        });
    } catch (error) {
        let errorMessage = 'Er ging iets mis bij het opslaan. Controleer of alle velden correct zijn ingevuld.';
        
        if (error.name === 'SequelizeValidationError') {
            // Validation error: User input issue. No server log needed, just UI feedback.

            // Check for specific email error
            const emailError = error.errors.find(e => e.path === 'email' && e.validatorKey === 'isEmail');
            if (emailError) {
                errorMessage = 'Het opgegeven e-mailadres is ongeldig. Controleer op typefouten.';
            } else {
                errorMessage = error.errors.map(e => e.message).join('. ');
            }
        } else {
            // Log full error for unexpected issues
            console.error('Registration error:', error);
        }

        res.render('public/register', { 
            title: 'Inschrijven bij Chiro Vreugdeland', 
            description: 'Schrijf jezelf of je kind in voor het nieuwe Chirojaar. Alle groepen zijn welkom!',
            content, 
            isRegistrationOpen,
            error: errorMessage 
        });
    }
};

const nodemailer = require('nodemailer');
const { sendMail } = require('../config/mailer');
const PeriodService = require('../services/PeriodService');

exports.getContact = (req, res) => {
    res.render('public/contact', { 
        title: 'Contact - Chiro Vreugdeland Meeuwen', 
        description: 'Contacteer de leiding van Chiro Vreugdeland Meeuwen. Stel je vragen of geef feedback.',
        contactFormDisabled: process.env.DISABLE_CONTACT_FORM === 'true',
        recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY
    });
};

exports.postContact = async (req, res) => {
    if (process.env.DISABLE_CONTACT_FORM === 'true') {
        return res.render('public/contact', { 
            title: 'Contact - Chiro Vreugdeland Meeuwen', 
            description: 'Contacteer de leiding van Chiro Vreugdeland Meeuwen. Stel je vragen of geef feedback.',
            contactFormDisabled: true, 
            error: 'Deze functie is tijdelijk nog niet beschikbaar',
            recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY
        });
    }

    const { name, email, message, website } = req.body;
    const recaptchaResponse = req.body['g-recaptcha-response'];

    // Honeypot check: if 'website' is filled, it's likely a bot.
    if (website) {
        console.log(`Spam detected: Honeypot filled by ${email}`);
        return res.render('public/contact', { title: 'Contact', success: true, recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY });
    }

    // reCAPTCHA v3 verification
    if (!recaptchaResponse) {
        return res.render('public/contact', { 
            title: 'Contact', 
            error: 'Er is een fout opgetreden bij de spam-check. Probeer het opnieuw.',
            recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY 
        });
    }

    try {
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaResponse}`;
        const recaptchaRes = await fetch(verifyUrl, { method: 'POST' });
        const recaptchaJson = await recaptchaRes.json();

        // Check success and score (0.0 - 1.0). Threshold 0.5 is standard.
        if (!recaptchaJson.success || recaptchaJson.score < 0.5) {
            console.log(`Spam blocked: reCAPTCHA score ${recaptchaJson.score} for ${email}`);
            return res.render('public/contact', { 
                title: 'Contact', 
                error: 'Ons systeem vermoedt dat dit bericht spam is. Probeer het later opnieuw of stuur een mail via je eigen mailprogramma.',
                recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY 
            });
        }

        await sendMail({
            to: process.env.CONTACT_EMAIL || 'Chiromeeuwen@outlook.com',
            replyTo: email,
            subject: `Nieuw bericht van ${name} via Website`,
            text: `Naam: ${name}\nEmail: ${email}\n\nBericht:\n${message}`,
            html: `<p><strong>Naam:</strong> ${name}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Bericht:</strong></p>
                   <p>${message.replace(/\n/g, '<br>')}</p>`
        });
        
        res.render('public/contact', { title: 'Contact', success: true, recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY });
    } catch (error) {
        console.error('Email/Captcha error:', error);
        res.render('public/contact', { title: 'Contact', error: 'Er ging iets mis bij het versturen. Probeer het later opnieuw.', recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY });
    }
};

exports.getHelp = (req, res) => {
    res.render('public/notifications_help', { 
        title: 'Hulp & Informatie - Chiro Vreugdeland Meeuwen', 
        description: 'Alles wat je moet weten over het gebruik van de Chiro website, van kalender-sync tot meldingen.'
    });
};

exports.getCalendarHelp = (req, res) => {
    const calendarUrl = `${req.protocol}://${req.get('host')}/kalender/subscribe.ics${req.user && req.user.calendarToken ? '?token=' + req.user.calendarToken : ''}`;
    res.render('public/calendar_help', {
        title: 'Kalender Koppelen - Chiro Vreugdeland Meeuwen',
        description: 'Stappenplan om de Chiro-kalender toe te voegen aan je iPhone, Android of Google Calendar.',
        calendarUrl
    });
};

exports.getRobotsTxt = (req, res) => {
    const content = `# Robots.txt for Chiro Vreugdeland Meeuwen
# Allow search engines to crawl public content

User-agent: *
Allow: /
Allow: /public/
Allow: /*.css$
Allow: /*.js$
Allow: /img/
Allow: /favicon.ico
Allow: /manifest.json
Disallow: /admin
Disallow: /account
Disallow: /auth
Disallow: /feed
Disallow: /api/
Disallow: /*.json$
Crawl-delay: 1
User-agent: AhrefsBot
User-agent: SemrushBot
Disallow: /

Sitemap: https://www.chiromeeuwen.be/sitemap.xml
`;
    res.type('text/plain').send(content);
};

exports.getSitemapXml = (req, res) => {
    const baseUrl = 'https://www.chiromeeuwen.be';
    const lastmod = new Date().toISOString().split('T')[0];
    const urls = [
        { loc: '/', changefreq: 'weekly', priority: '1.0', lastmod },
        { loc: '/praktisch', changefreq: 'monthly', priority: '0.9', lastmod },
        { loc: '/afdelingen', changefreq: 'yearly', priority: '0.8', lastmod },
        { loc: '/leiding', changefreq: 'monthly', priority: '0.8', lastmod },
        { loc: '/kalender', changefreq: 'weekly', priority: '0.9', lastmod },
        { loc: '/t-shirts', changefreq: 'monthly', priority: '0.7', lastmod },
        { loc: '/inschrijven', changefreq: 'yearly', priority: '0.9', lastmod },
        { loc: '/contact', changefreq: 'yearly', priority: '0.7', lastmod },
        { loc: '/help', changefreq: 'monthly', priority: '0.6', lastmod }
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
` +
        urls.map(u => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n') +
        `
</urlset>`;
    res.type('application/xml').send(xml);
};

exports.downloadFile = (req, res) => {
    try {
        const publicDir = path.join(__dirname, '..', 'public');
        const filePath = path.join(publicDir, req.query.path);
        
        // Security: prevent path traversal
        const relative = path.relative(publicDir, filePath);
        if (relative.startsWith('..')) {
            return res.status(403).json({ error: 'Verboden' });
        }
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Bestand niet gevonden' });
        }

        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Dit is een map, geen bestand' });
        }
        
        // Try to get original filename if available
        const originalName = req.query.name || path.basename(filePath);
        
        res.download(filePath, originalName);
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ error: 'Fout bij downloaden bestand' });
    }
};
