const { PageContent, Leader, Event, Registration } = require('../models');
const { Op } = require('sequelize');

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

exports.getHome = async (req, res) => {
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
        const groupOrder = ['Ribbels', 'Speelclub', 'Rakwi\'s', 'Tito\'s', 'Keti\'s', 'Aspi\'s'];
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
    try {
        const events = await Event.findAll({ 
            where: { date: { [Op.gte]: new Date() } },
            order: [['date', 'ASC']]
        });
        res.render('public/calendar', { 
            title: 'Kalender & Activiteiten - Chiro Vreugdeland', 
            description: 'De volledige kalender van Chiro Vreugdeland: mis geen activiteiten, zondagen of speciale evenementen.',
            events 
        });
    } catch (error) {
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
        res.render('public/register', { 
            title: 'Inschrijven bij Chiro Vreugdeland', 
            description: 'Schrijf jezelf of je kind in voor het nieuwe Chirojaar. Alle groepen zijn welkom!',
            content 
        });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.postRegister = async (req, res) => {
    const content = await getContent('register');
    try {
        const payload = {
            type: req.body.type === 'leiding' ? 'leiding' : 'lid',
            firstName: (req.body.firstName || '').trim(),
            lastName: (req.body.lastName || '').trim(),
            birthdate: req.body.birthdate,
            memberPhone: req.body.memberPhone || null,
            parentsNames: req.body.parentsNames || null,
            parentsPhone: req.body.parentsPhone || null,
            phone: req.body.phone || null,
            email: (req.body.email || '').trim(),
            photoPermission: req.body.photoPermission === 'on' || req.body.photoPermission === 'true',
            medicalInfo: req.body.medicalInfo || null,
            group: (req.body.group || '').toLowerCase(),
            privacyAccepted: req.body.privacyAccepted === 'on' || req.body.privacyAccepted === 'true'
        };
        const validGroups = ['ribbel','speelclub','rakwi','tito','keti','aspi'];
        if (!validGroups.includes(payload.group)) {
            throw new Error('invalid group');
        }
        if (!payload.firstName || !payload.lastName || !payload.birthdate || !payload.email || !payload.privacyAccepted) {
            throw new Error('missing fields');
        }
        
        payload.period = await PeriodService.getCurrentPeriod();

                        await Registration.create(payload);
                        res.render('public/register', { 
                            title: 'Inschrijven bij Chiro Vreugdeland', 
                            description: 'Schrijf jezelf of je kind in voor het nieuwe Chirojaar. Alle groepen zijn welkom!',
                            content, 
                            success: 'Bedankt voor je inschrijving! We hebben de gegevens goed ontvangen.' 
                        });    } catch (error) {
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
            to: 'Chiromeeuwen@outlook.com',
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
        { loc: '/contact', changefreq: 'yearly', priority: '0.7', lastmod }
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
