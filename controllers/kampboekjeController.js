const { KampboekjeEntry, User } = require('../models');
const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');

const sanitizeOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'u', 's', 'blockquote', 'code', 'pre', 'span', 'h1', 'h2', 'h3', 'h4'],
    allowedAttributes: {
        'a': ['href', 'target', 'rel'],
        'span': ['class', 'style']
    },
    allowedSchemes: ['http', 'https', 'mailto']
};

const viewHelpers = {
    formatDate: (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    getAvatarColor: (name) => {
        if (!name) return '#db3e41';
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colors = ['#db3e41', '#28a745', '#007bff', '#fd7e14', '#6f42c1', '#e83e8c', '#17a2b8'];
        return colors[Math.abs(hash) % colors.length];
    }
};

exports.getEntries = async (req, res) => {
    try {
        const { campName, category, q } = req.query;

        let whereClause = {};

        if (campName && campName.trim() !== '') {
            whereClause.campName = campName.trim();
        }
        if (category && category.trim() !== '' && category !== 'Alle') {
            whereClause.category = category.trim();
        }
        if (q && q.trim() !== '') {
            const queryStr = `%${q.trim()}%`;
            whereClause[Op.or] = [
                { title: { [Op.like]: queryStr } },
                { content: { [Op.like]: queryStr } },
                { dayDate: { [Op.like]: queryStr } }
            ];
        }

        const entries = await KampboekjeEntry.findAll({
            where: whereClause,
            order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'profilePicture', 'role']
                }
            ]
        });

        // Get distinct camp names & categories for filtering
        const allEntries = await KampboekjeEntry.findAll({ attributes: ['campName', 'category'] });
        const campNames = [...new Set(allEntries.map(e => e.campName).filter(Boolean))];
        const categories = [...new Set(allEntries.map(e => e.category).filter(Boolean))];

        if (campNames.length === 0) campNames.push('Zomerkamp 2026');

        res.render('kampboekje/index', {
            title: 'Kampboekje',
            entries,
            user: req.user,
            campNames,
            categories,
            selectedCamp: campName || '',
            selectedCategory: category || 'Alle',
            searchQuery: q || '',
            capitalizeName: (name) => name ? name.charAt(0).toUpperCase() + name.slice(1) : '',
            ...viewHelpers
        });
    } catch (error) {
        console.error('Kampboekje getEntries Error:', error);
        res.status(500).send('Server Error');
    }
};

exports.createEntry = async (req, res) => {
    try {
        const { title, content, campName, dayDate, category } = req.body;

        if (!title || !content) {
            return res.redirect('/kampboekje?error=Titel en verhaal zijn verplicht.');
        }

        let cleanContent = sanitizeHtml(content.trim(), sanitizeOptions);

        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map(file => ({
                path: '/uploads/feed/' + file.filename,
                originalName: file.originalname
            }));
        }

        await KampboekjeEntry.create({
            title: title.trim(),
            content: cleanContent,
            images,
            campName: campName ? campName.trim() : 'Zomerkamp 2026',
            dayDate: dayDate ? dayDate.trim() : null,
            category: category ? category.trim() : 'Algemeen',
            authorId: req.user.id
        });

        res.redirect('/kampboekje?success=Entry toegevoegd aan het Kampboekje!');
    } catch (error) {
        console.error('Kampboekje createEntry Error:', error);
        res.redirect('/kampboekje?error=Kon entry niet toevoegen.');
    }
};

exports.updateEntry = async (req, res) => {
    try {
        const entry = await KampboekjeEntry.findByPk(req.params.id);
        if (!entry) {
            return res.redirect('/kampboekje?error=Entry niet gevonden.');
        }

        if (entry.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.redirect('/kampboekje?error=Geen toestemming.');
        }

        const { title, content, campName, dayDate, category } = req.body;

        let cleanContent = sanitizeHtml(content.trim(), sanitizeOptions);

        let newImages = entry.images || [];
        if (req.files && req.files.length > 0) {
            const uploaded = req.files.map(file => ({
                path: '/uploads/feed/' + file.filename,
                originalName: file.originalname
            }));
            newImages = [...newImages, ...uploaded];
        }

        await entry.update({
            title: title ? title.trim() : entry.title,
            content: cleanContent,
            campName: campName ? campName.trim() : entry.campName,
            dayDate: dayDate ? dayDate.trim() : entry.dayDate,
            category: category ? category.trim() : entry.category,
            images: newImages
        });

        res.redirect('/kampboekje?success=Entry bijgewerkt!');
    } catch (error) {
        console.error('Kampboekje updateEntry Error:', error);
        res.redirect('/kampboekje?error=Kon entry niet bijwerken.');
    }
};

exports.deleteEntry = async (req, res) => {
    try {
        const entry = await KampboekjeEntry.findByPk(req.params.id);
        if (!entry) {
            return res.redirect('/kampboekje?error=Entry niet gevonden.');
        }

        if (entry.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.redirect('/kampboekje?error=Geen toestemming.');
        }

        await entry.destroy();
        res.redirect('/kampboekje?success=Entry verwijderd.');
    } catch (error) {
        console.error('Kampboekje deleteEntry Error:', error);
        res.redirect('/kampboekje?error=Kon entry niet verwijderen.');
    }
};

exports.togglePin = async (req, res) => {
    try {
        const entry = await KampboekjeEntry.findByPk(req.params.id);
        if (!entry) {
            return res.redirect('/kampboekje?error=Entry niet gevonden.');
        }

        await entry.update({ isPinned: !entry.isPinned });
        res.redirect('/kampboekje');
    } catch (error) {
        console.error('Kampboekje togglePin Error:', error);
        res.redirect('/kampboekje?error=Kon pinstatus niet aanpassen.');
    }
};
