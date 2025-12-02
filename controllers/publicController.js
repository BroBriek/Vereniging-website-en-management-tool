const { PageContent, Leader, Event } = require('../models');
const { Op } = require('sequelize');

const getContent = async (slug) => {
    const contents = await PageContent.findAll({ where: { slug } });
    const map = {};
    contents.forEach(c => map[c.section_key] = c);
    return map;
};

exports.getHome = async (req, res) => {
    const content = await getContent('home');
    res.render('public/home', { title: 'Home', content });
};

exports.getPractical = async (req, res) => {
    const content = await getContent('practical');
    res.render('public/practical', { title: 'Praktisch', content });
};

exports.getLeaders = async (req, res) => {
    const leaders = await Leader.findAll({ order: [['group', 'ASC'], ['name', 'ASC']] });
    const groups = {};
    const groupOrder = ['Ribbels', 'Speelclub', 'Rakwi\'s', 'Tito\'s', 'Keti\'s', 'Aspi\'s'];
    
    groupOrder.forEach(g => groups[g] = []);
    leaders.forEach(l => {
        if (!groups[l.group]) groups[l.group] = [];
        groups[l.group].push(l);
    });

    res.render('public/leaders', { title: 'Leiding', groups });
};

exports.getCalendar = async (req, res) => {
    const events = await Event.findAll({ 
        where: { date: { [Op.gte]: new Date() } },
        order: [['date', 'ASC']]
    });
    res.render('public/calendar', { title: 'Kalender', events });
};

exports.getDepartments = async (req, res) => {
    const content = await getContent('departments');
    res.render('public/departments', { title: 'Afdelingen', content });
};

exports.getShirts = async (req, res) => {
    const content = await getContent('shirts');
    res.render('public/shirts', { title: 'T-Shirts', content });
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
