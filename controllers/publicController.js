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
            title: 'Home', 
            description: 'Welkom bij Chiro Vreugdeland Meeuwen! De plek voor spel, plezier en vriendschap in Meeuwen. Ontdek onze werking.',
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
            title: 'Praktisch', 
            description: 'Praktische info over Chiro Vreugdeland: lidgeld, uniformen, uren en locatie.',
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
            title: 'Leiding', 
            description: 'Maak kennis met de leiding van Chiro Vreugdeland.',
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
            title: 'Kalender', 
            description: 'De kalender van Chiro Vreugdeland: mis geen enkele activiteit, zondag of evenement!',
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
            title: 'Afdelingen', 
            description: 'Ontdek onze afdelingen: Ribbels, Speelclub, Rakwi\'s, Tito\'s, Keti\'s en Aspi\'s.',
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
            title: 'T-Shirts', 
            description: 'Koop coole Chiro Vreugdeland T-shirts. Bekijk hier de maten en prijzen.',
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
            title: 'Inschrijven', 
            description: 'Schrijf je in voor het nieuwe Chirojaar bij Chiro Vreugdeland Meeuwen!',
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
        await Registration.create(payload);
        res.render('public/register', { 
            title: 'Inschrijven', 
            description: 'Schrijf je in voor het nieuwe Chirojaar bij Chiro Vreugdeland Meeuwen!',
            content, 
            success: true 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.render('public/register', { 
            title: 'Inschrijven', 
            description: 'Schrijf je in voor het nieuwe Chirojaar bij Chiro Vreugdeland Meeuwen!',
            content, 
            error: 'Er ging iets mis bij het opslaan. Controleer of alle velden correct zijn ingevuld.' 
        });
    }
};

const nodemailer = require('nodemailer');
const { sendMail } = require('../config/mailer');

exports.getContact = (req, res) => {
    res.render('public/contact', { 
        title: 'Contact', 
        description: 'Contacteer de leiding van Chiro Vreugdeland Meeuwen voor al je vragen.',
        contactFormDisabled: process.env.DISABLE_CONTACT_FORM === 'true' 
    });
};

exports.postContact = async (req, res) => {
    if (process.env.DISABLE_CONTACT_FORM === 'true') {
        return res.render('public/contact', { 
            title: 'Contact', 
            description: 'Contacteer de leiding van Chiro Vreugdeland Meeuwen voor al je vragen.',
            contactFormDisabled: true, 
            error: 'Deze functie is tijdelijk nog niet beschikbaar' 
        });
    }

    const { name, email, message } = req.body;

    try {
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
        
        res.render('public/contact', { title: 'Contact', success: true });
    } catch (error) {
        console.error('Email error:', error);
        res.render('public/contact', { title: 'Contact', error: 'Er ging iets mis bij het versturen. Probeer het later opnieuw.' });
    }
};

exports.getRobotsTxt = (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const content = `User-agent: *\nDisallow: /leiding\nSitemap: ${baseUrl}/sitemap.xml\n`;
    res.type('text/plain').send(content);
};

exports.getSitemapXml = (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const urls = ['/', '/praktisch', '/kalender', '/afdelingen', '/t-shirts', '/inschrijven', '/contact'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(u => `  <url><loc>${baseUrl}${u}</loc></url>`).join('\n') +
        `\n</urlset>`;
    res.type('application/xml').send(xml);
};
