const { KampboekjeEntry, User } = require('../models');
const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');

const sanitizeOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'iframe', 'h1', 'h2', 'h3', 'h4', 'span', 'u', 's', 'div' ]),
    allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        'img': [ 'src', 'alt', 'title', 'width', 'height', 'style', 'class' ],
        'iframe': [ 'src', 'width', 'height', 'frameborder', 'allowfullscreen' ],
        'a': [ 'href', 'target', 'rel', 'class', 'style' ],
        'span': [ 'class', 'style' ],
        'div': [ 'class', 'style' ],
        '*': [ 'style', 'class' ]
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data']
};

const processInlineMedia = (html) => {
    if (!html) return '';
    const imgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*>/gi;
    return html.replace(imgRegex, (match, src) => {
        if (match.includes('onclick=')) return match;
        const filename = src.split('/').pop() || 'Foto';
        return `<a href="${src}" onclick="openFilePreview('${src}', '${filename}'); return false;" class="d-inline-block text-decoration-none my-1">${match}</a>`;
    });
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
    },
    formatEntryContent: (content) => {
        if (!content) return '';
        if (/<[a-z][\s\S]*>/i.test(content)) {
            return content;
        }
        return content.split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');
    },
    extractPostMedia: (entryContent, rawImages) => {
        let images = [];
        if (rawImages) {
            if (Array.isArray(rawImages)) {
                images = [...rawImages];
            } else if (typeof rawImages === 'string') {
                try { images = JSON.parse(rawImages); } catch(e) { images = []; }
            }
        }

        // Normalize attached image paths: replace /uploads/feed/ with /feed_uploads/
        images = images.map(img => {
            if (img && img.path) {
                let p = img.path;
                if (p.startsWith('/uploads/feed/')) p = p.replace('/uploads/feed/', '/feed_uploads/');
                return { ...img, path: p };
            }
            return img;
        });

        let textContent = entryContent || '';
        if (textContent.includes('/uploads/feed/')) {
            textContent = textContent.replace(/\/uploads\/feed\//g, '/feed_uploads/');
        }

        return { textContent, images };
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
        let { title, content, campName, dayDate, category } = req.body;

        let rawContent = (content || '').trim();
        let cleanContent = sanitizeHtml(rawContent, sanitizeOptions);
        cleanContent = processInlineMedia(cleanContent);

        // Check if content has text or images
        const textOnly = cleanContent.replace(/<[^>]*>/g, '').trim();
        const hasInlineImage = cleanContent.includes('<img');

        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map(file => ({
                path: '/feed_uploads/' + file.filename,
                originalName: file.originalname
            }));
        }

        const hasAttachedImages = images.length > 0;

        if (!textOnly && !hasInlineImage && !hasAttachedImages) {
            return res.redirect('/kampboekje?error=Voeg een verhaal of ten minste één foto toe.');
        }

        if (!title || !title.trim()) {
            if (hasAttachedImages || hasInlineImage) {
                title = category && category !== 'Algemeen' ? `Foto's - ${category}` : "Foto-album";
            } else {
                title = 'Kampboekje Inzending';
            }
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

        let { title, content, campName, dayDate, category, keepExistingImages } = req.body;

        let rawContent = (content || '').trim();
        let cleanContent = sanitizeHtml(rawContent, sanitizeOptions);
        cleanContent = processInlineMedia(cleanContent);

        const textOnly = cleanContent.replace(/<[^>]*>/g, '').trim();
        const hasInlineImage = cleanContent.includes('<img');

        let currentImages = [];
        if (keepExistingImages === 'true' || keepExistingImages === true || keepExistingImages === 'on') {
            if (entry.images) {
                if (Array.isArray(entry.images)) {
                    currentImages = entry.images;
                } else if (typeof entry.images === 'string') {
                    try { currentImages = JSON.parse(entry.images); } catch(e) { currentImages = []; }
                }
            }
        }

        if (req.files && req.files.length > 0) {
            const uploaded = req.files.map(file => ({
                path: '/feed_uploads/' + file.filename,
                originalName: file.originalname
            }));
            currentImages = [...currentImages, ...uploaded];
        }

        const hasAttachedImages = currentImages.length > 0;

        if (!textOnly && !hasInlineImage && !hasAttachedImages) {
            return res.redirect('/kampboekje?error=Voeg een verhaal of ten minste één foto toe.');
        }

        if (!title || !title.trim()) {
            title = entry.title || (category && category !== 'Algemeen' ? `Foto's - ${category}` : "Foto-album");
        }

        await entry.update({
            title: title.trim(),
            content: cleanContent,
            campName: campName ? campName.trim() : entry.campName,
            dayDate: dayDate ? dayDate.trim() : entry.dayDate,
            category: category ? category.trim() : entry.category,
            images: currentImages
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

