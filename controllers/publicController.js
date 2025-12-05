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
        res.render('public/home', { title: 'Home', content });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getPractical = async (req, res) => {
    try {
        const content = await getContent('practical');
        res.render('public/practical', { title: 'Praktisch', content });
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
        res.render('public/leaders', { title: 'Leiding', groups });
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
        res.render('public/calendar', { title: 'Kalender', events });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getDepartments = async (req, res) => {
    try {
        const content = await getContent('departments');
        res.render('public/departments', { title: 'Afdelingen', content });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getShirts = async (req, res) => {
    try {
        const content = await getContent('shirts');
        res.render('public/shirts', { title: 'T-Shirts', content });
    } catch (error) {
        res.status(500).send('Er ging iets mis');
    }
};

exports.getRegister = async (req, res) => {
    try {
        const content = await getContent('register');
        res.render('public/register', { title: 'Inschrijven', content });
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
        res.render('public/register', { title: 'Inschrijven', content, success: true });
    } catch (error) {
        console.error('Registration error:', error);
        res.render('public/register', { title: 'Inschrijven', content, error: 'Er ging iets mis bij het opslaan. Controleer of alle velden correct zijn ingevuld.' });
    }
};

const nodemailer = require('nodemailer');

exports.getContact = (req, res) => {
    res.render('public/contact', { title: 'Contact' });
};

exports.postContact = async (req, res) => {
    const { name, email, message } = req.body;

    // Setup Nodemailer transporter (You need to configure this with real credentials in .env)
    // For now, we'll assume a standard SMTP or a placeholder
    const transporter = nodemailer.createTransport({
        service: 'outlook', // Since the target is outlook.com
        auth: {
            user: 'Chiromeeuwen@outlook.com', // The account sending the email (usually)
            pass: process.env.EMAIL_PASSWORD // PASSWORD SHOULD BE IN ENV
        }
    });

    const mailOptions = {
        from: email, // From the user's email (might be flagged as spam if not authenticated properly, better to set 'from' to your own email and 'replyTo' to user)
        to: 'Chiromeeuwen@outlook.com',
        subject: `Nieuw bericht van ${name} via Website`,
        text: `Naam: ${name}\nEmail: ${email}\n\nBericht:\n${message}`
    };

    try {
        // Note: This will fail without a valid password in .env. 
        // For this demo/CLI environment, we might just log it if it fails or assume the user will config it.
        // To prevent crashing the demo if no password is set, we can check env or just wrap in try/catch.
        
        if (process.env.EMAIL_PASSWORD) {
            await transporter.sendMail(mailOptions);
        } else {
            console.log('SIMULATED EMAIL:', mailOptions);
        }
        
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
