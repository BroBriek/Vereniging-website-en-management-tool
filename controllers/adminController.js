const { PageContent, Leader, Event } = require('../models');

exports.getDashboard = (req, res) => {
    res.render('admin/dashboard', { title: 'Admin Dashboard', user: req.user });
};

exports.getEditPage = async (req, res) => {
    const slug = req.params.page;
    const contents = await PageContent.findAll({ where: { slug } });
    const contentMap = {};
    contents.forEach(c => contentMap[c.section_key] = c);
    
    res.render('admin/edit_page', { title: `Bewerk ${slug}`, slug, contentMap, user: req.user });
};

exports.postEditPage = async (req, res) => {
    const slug = req.params.page;
    
    // Handle text fields
    for (const key in req.body) {
        if (key === 'image_key') continue; 
        await PageContent.upsert({
            slug,
            section_key: key,
            content: req.body[key]
        });
    }

    // Handle Image Upload
    if (req.file) {
        const imageKey = req.body.image_key || 'hero_image';
        await PageContent.upsert({
            slug,
            section_key: imageKey,
            content: `/uploads/${req.file.filename}`
        });
    }
    
    res.redirect(`/admin/page/${slug}`);
};

exports.getLeaders = async (req, res) => {
    const leaders = await Leader.findAll({ order: [['group', 'ASC']] });
    res.render('admin/leaders', { title: 'Beheer Leiding', leaders, user: req.user });
};

exports.postLeader = async (req, res) => {
    const { name, group, years_active, study, extra_info } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    await Leader.create({ name, group, years_active, study, extra_info, image });
    res.redirect('/admin/leaders');
};

exports.deleteLeader = async (req, res) => {
    await Leader.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/leaders');
};

exports.getEvents = async (req, res) => {
    const events = await Event.findAll({ order: [['date', 'DESC']] });
    res.render('admin/events', { title: 'Beheer Kalender', events, user: req.user });
};

exports.postEvent = async (req, res) => {
    const { title, date, description } = req.body;
    await Event.create({ title, date, description });
    res.redirect('/admin/events');
};

exports.deleteEvent = async (req, res) => {
    await Event.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/events');
};

exports.getInfo = (req, res) => {
    res.render('admin/info', { title: 'Handleiding', user: req.user });
};