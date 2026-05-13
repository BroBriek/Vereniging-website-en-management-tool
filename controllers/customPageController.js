const { CustomPage, User } = require('../models');
const CustomPageService = require('../services/CustomPageService');

exports.getCustomPages = async (req, res) => {
    res.redirect('/admin/pages');
};

exports.getCreatePage = (req, res) => {
    res.render('admin/custom_pages/builder', { title: 'Nieuwe Pagina', page: null, user: req.user });
};

exports.postCreatePage = async (req, res) => {
    try {
        const { title, status, content, bannerEnabled, showInNavbar, isLinkOnly } = req.body;
        
        let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const exists = await CustomPage.findOne({ where: { slug } });
        if (exists) {
            slug += '-' + Math.random().toString(36).substring(2, 7);
        }

        const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;

        await CustomPage.create({
            title,
            slug,
            status,
            content: parsedContent,
            showInNavbar: showInNavbar === 'true',
            isLinkOnly: isLinkOnly === 'true',
            bannerEnabled: bannerEnabled === 'true',
            bannerImage: req.file ? '/uploads/' + req.file.filename : null,
            creatorId: req.user.id
        });

        await CustomPageService.reload();

        res.redirect('/admin/pages?success=Pagina aangemaakt');
    } catch (error) {
        console.error('Error creating custom page:', error);
        res.redirect('/admin/pages?error=Kon pagina niet aanmaken');
    }
};

exports.getEditPage = async (req, res) => {
    try {
        const page = await CustomPage.findByPk(req.params.id);
        if (!page) return res.redirect('/admin/pages?error=Pagina niet gevonden');
        
        res.render('admin/custom_pages/builder', { title: 'Bewerk Pagina', page, user: req.user });
    } catch (error) {
        console.error('Error fetching page for edit:', error);
        res.redirect('/admin/pages?error=Kon pagina niet laden');
    }
};

exports.postEditPage = async (req, res) => {
    try {
        const { title, status, content, bannerEnabled, showInNavbar, isLinkOnly } = req.body;
        const page = await CustomPage.findByPk(req.params.id);
        if (!page) return res.redirect('/admin/pages?error=Pagina niet gevonden');

        const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;

        const updateData = {
            title,
            status,
            content: parsedContent,
            showInNavbar: showInNavbar === 'true',
            isLinkOnly: isLinkOnly === 'true',
            bannerEnabled: bannerEnabled === 'true'
        };

        if (req.file) {
            updateData.bannerImage = '/uploads/' + req.file.filename;
        }

        await page.update(updateData);
        await CustomPageService.reload();

        res.redirect('/admin/pages?success=Pagina bijgewerkt');
    } catch (error) {
        console.error('Error updating custom page:', error);
        res.redirect('/admin/pages?error=Kon pagina niet bijwerken');
    }
};

exports.deletePage = async (req, res) => {
    try {
        const page = await CustomPage.findByPk(req.params.id);
        if (!page) return res.redirect('/admin/pages?error=Pagina niet gevonden');
        
        await page.destroy();
        await CustomPageService.reload();
        res.redirect('/admin/pages?success=Pagina verwijderd');
    } catch (error) {
        console.error('Error deleting custom page:', error);
        res.redirect('/admin/pages?error=Kon pagina niet verwijderen');
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const page = await CustomPage.findByPk(req.params.id);
        if (!page) return res.redirect('/admin/pages?error=Pagina niet gevonden');
        
        page.status = page.status === 'visible' ? 'invisible' : 'visible';
        await page.save();
        await CustomPageService.reload();
        
        res.redirect('/admin/pages?success=Pagina status bijgewerkt');
    } catch (error) {
        console.error('Error toggling custom page status:', error);
        res.redirect('/admin/pages?error=Kon status niet bijwerken');
    }
};

// Public view
exports.getPublicPage = async (req, res) => {
    try {
        const page = await CustomPage.findOne({ 
            where: { 
                slug: req.params.slug,
                status: 'visible'
            } 
        });
        
        if (!page) {
            return res.status(404).render('error', { 
                title: 'Pagina niet gevonden',
                status: 404,
                message: 'Pagina niet gevonden', 
                description: 'De opgevraagde pagina bestaat niet of is nog niet gepubliceerd.',
                user: req.user 
            });
        }
        
        res.render('public/custom_page', { 
            title: page.title, 
            page, 
            user: req.user 
        });
    } catch (error) {
        console.error('Error fetching public custom page:', error);
        res.status(500).render('error', { 
            title: 'Server Fout',
            status: 500,
            message: 'Er is een fout opgetreden', 
            description: 'Onze excuses, er is een interne serverfout opgetreden.',
            user: req.user 
        });
    }
};
