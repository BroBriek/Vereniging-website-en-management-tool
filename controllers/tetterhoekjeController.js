const { Post, User, Comment, Like, FeedGroup, Leader, Announcement, SurveyResponse, PostResponse } = require('../models');
const NotificationService = require('../services/NotificationService');
const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');

const sanitizeOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'u', 's', 'blockquote', 'code', 'pre', 'span'],
    allowedAttributes: {
        'a': ['href', 'target', 'rel'],
        'span': ['class', 'style']
    },
    allowedSchemes: ['http', 'https', 'mailto']
};

const extractMentions = (text) => {
    if (!text) return [];
    const matches = text.match(/@([A-ZÀ-ÖØ-Þ][\wÀ-ÿ]*(?:\s+[A-ZÀ-ÖØ-Þ][\wÀ-ÿ]*)*|[\wÀ-ÿ]+)/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.substring(1).toLowerCase()))];
};

const highlightMentions = (text) => {
    if (!text) return '';
    const parts = text.split(/(<[^>]+>)/g);
    const processedParts = parts.map(part => {
        if (part.startsWith('<')) {
            const lowerPart = part.toLowerCase();
            if (lowerPart.startsWith('<img')) {
                const srcMatch = part.match(/src="([^"]+)"/);
                if (srcMatch) {
                    const src = srcMatch[1];
                    const filename = src.split('/').pop();
                    let extraAttrs = '';
                    if (src.includes('http') && !src.includes('/uploads/') && !src.includes('/feed_uploads/')) {
                        extraAttrs = ' onerror="handleBrokenImage(this)"';
                    }
                    const modifiedImg = part.replace('>', extraAttrs + '>');
                    return `<a href="${src}" onclick="openFilePreview('${src}', '${filename}'); return false;" class="d-inline-block">${modifiedImg}</a>`;
                }
            }
            if (lowerPart.startsWith('<a')) {
                const hrefMatch = part.match(/href="([^"]+\.(pdf|docx?|xlsx?|pptx?))"/i);
                if (hrefMatch) {
                    const href = hrefMatch[1];
                    const filename = href.split('/').pop();
                    if (!part.includes('onclick=')) {
                        return part.replace('>', ` onclick="openFilePreview('${href}', '${filename}'); return false;">`);
                    }
                }
            }
            return part;
        }
        return part.replace(/@([A-ZÀ-ÖØ-Þ][\wÀ-ÿ]*(?:\s+[A-ZÀ-ÖØ-Þ][\wÀ-ÿ]*)*|[\wÀ-ÿ]+)/g, (match, username) => {
            const capitalized = username.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            return `<span class="text-primary fw-bold">@${capitalized}</span>`;
        });
    });
    return processedParts.join('');
};

const stripHtml = (text) => {
    return (text || '').replace(/<[^>]+>/g, '');
};

const slugify = (text) => {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

const viewHelpers = {
    formatDate: (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    formatDateTime: (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    getInitials: (username) => {
        if (!username) return '?';
        return username.substring(0, 2).toUpperCase();
    },
    highlightMentions,
    stripHtml,
    slugify
};

const ensureDefaultTetterGroup = async () => {
    let group = await FeedGroup.findOne({ where: { isTetterhoekje: true } });
    if (!group) {
        group = await FeedGroup.create({
            name: 'Het Tetterhoekje',
            slug: 'tetterhoekje',
            description: 'Het exclusieve praathoekje voor kookmoekes en leiding.',
            isEvent: false,
            isTetterhoekje: true
        });
    }
    return group;
};

exports.getFeed = async (req, res) => {
    try {
        await ensureDefaultTetterGroup();
        const tetterGroups = await FeedGroup.findAll({
            where: { isTetterhoekje: true },
            order: [['isEvent', 'ASC'], ['year', 'DESC'], ['name', 'ASC']]
        });

        const slug = req.params.slug || null;
        let activeGroup = null;
        if (slug) {
            activeGroup = tetterGroups.find(g => g.slug === slug);
        }
        if (!activeGroup) {
            activeGroup = tetterGroups.find(g => !g.isEvent) || tetterGroups[0] || null;
        }

        const limit = parseInt(process.env.FEED_PAGINATION_LIMIT) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search || '';

        const allUsers = await User.findAll({ 
            where: { 
                isActive: true,
                username: { [Op.ne]: 'admin' }
            }, 
            attributes: ['id', 'username'], 
            order: [['username', 'ASC']] 
        });

        const whereClause = activeGroup ? { groupId: activeGroup.id } : { groupId: { [Op.in]: tetterGroups.map(g => g.id) } };

        if (search) {
             const matchingUsers = await User.findAll({
                 where: {
                     username: { [Op.like]: `%${search}%` }
                 },
                 attributes: ['id']
             });
             const matchingUserIds = matchingUsers.map(u => u.id);

             whereClause[Op.and] = [
                 activeGroup ? { groupId: activeGroup.id } : { groupId: { [Op.in]: tetterGroups.map(g => g.id) } },
                 {
                     [Op.or]: [
                         { content: { [Op.like]: `%${search}%` } },
                         { authorId: { [Op.in]: matchingUserIds } }
                     ]
                 }
             ];
             delete whereClause.groupId;
        }

        // 1. Fetch Posts
        const postsData = await Post.findAll({
            where: whereClause,
            include: [
                { model: User, as: 'author', attributes: ['id', 'username', 'profilePicture'] },
                { model: Like, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username', 'profilePicture'] }] },
                { model: PostResponse, as: 'responses', include: [{ model: User, as: 'user', attributes: ['id', 'username'] }] }
            ],
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset,
            distinct: true
        });

        // 2. Fetch all comments for these posts
        const postIds = postsData.map(p => p.id);
        const allComments = await Comment.findAll({
            where: { postId: { [Op.in]: postIds } },
            include: [
                { model: User, as: 'author', attributes: ['id', 'username', 'profilePicture'] },
                { model: Like, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username', 'profilePicture'] }] }
            ],
            order: [['createdAt', 'ASC']]
        });

        // 3. Build Comment Trees
        const commentMap = {};
        const commentsByPost = {};
        
        postIds.forEach(id => { commentsByPost[id] = []; });
        
        const plainComments = allComments.map(c => {
            const json = c.toJSON();
            json.replies = [];
            commentMap[json.id] = json;
            return json;
        });

        plainComments.forEach(c => {
            if (c.parentId && commentMap[c.parentId]) {
                commentMap[c.parentId].replies.push(c);
            } else {
                if (commentsByPost[c.postId]) {
                    commentsByPost[c.postId].push(c);
                }
            }
        });

        const posts = postsData.map(p => {
            const json = p.toJSON();
            json.comments = commentsByPost[p.id] || [];
            return json;
        });

        // Handle AJAX request for more posts
        if (req.xhr || req.query.ajax) {
            return res.render('feed/feed_items', { 
                posts, 
                user: req.user, 
                ...viewHelpers 
            }, (err, html) => {
                if (err) {
                    console.error('Render Partial Error:', err);
                    return res.status(500).json({ error: 'Render Error' });
                }
                res.json({ 
                    html, 
                    hasMore: postsData.length === limit 
                });
            });
        }

        // Birthday logic
        const today = new Date();
        const monthStr = (today.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = today.getDate().toString().padStart(2, '0');
        const todayMMDD = `${monthStr}-${dayStr}`;

        const leaders = await Leader.findAll({ attributes: ['name', 'birth_date'] });
        const birthdayLeaders = leaders.filter(l => {
            if (!l.birth_date) return false;
            const parts = l.birth_date.split('-');
            if (parts.length < 3) return false;
            return `${parts[1]}-${parts[2]}` === todayMMDD;
        });

        // Announcement
        const announcement = await Announcement.findOne({
            where: {
                isActive: true,
                target: {
                    [Op.or]: req.user.role === 'admin' ? ['all', 'admin'] : ['all']
                }
            },
            include: [{ model: SurveyResponse, as: 'surveyResponses' }],
            order: [['createdAt', 'DESC']]
        });

        let activeAnnouncement = null;
        let surveyStats = null;
        let userSurveyResponse = null;

        if (announcement) {
            let dismissedIds = [];
            if (req.user.dismissedAnnouncements) {
                if (Array.isArray(req.user.dismissedAnnouncements)) {
                    dismissedIds = req.user.dismissedAnnouncements;
                } else if (typeof req.user.dismissedAnnouncements === 'string') {
                    try { dismissedIds = JSON.parse(req.user.dismissedAnnouncements); } catch (e) { dismissedIds = []; }
                }
            }
            dismissedIds = dismissedIds.map(id => Number(id));
            if (!dismissedIds.includes(Number(announcement.id))) {
                activeAnnouncement = announcement;
                if (announcement.hasSurvey) {
                    const responses = announcement.surveyResponses || [];
                    userSurveyResponse = responses.find(r => r.userId === req.user.id) || null;
                    const totalCount = responses.length;
                    let targetCount = announcement.target === 'admin' 
                        ? await User.count({ where: { role: 'admin', isActive: true } })
                        : await User.count({ where: { isActive: true } });
                    const percentage = targetCount > 0 ? Math.round((totalCount / targetCount) * 100) : 0;
                    surveyStats = { totalCount, targetCount, percentage };
                }
            }
        }

        res.render('feed/index', { 
            title: activeGroup ? activeGroup.name : 'Het Tetterhoekje',
            feedTitle: 'Het Tetterhoekje',
            isTetterhoekje: true,
            posts, 
            user: req.user, 
            groups: tetterGroups, 
            activeGroup,
            limit,
            disableQuote: true, // Quote feature is disabled
            quoteOfTheMonth: null,
            birthdayLeaders,
            allUsers,
            allNormalGroups: tetterGroups,
            announcement: activeAnnouncement,
            surveyStats,
            userSurveyResponse,
            capitalizeName: (name) => name ? name.charAt(0).toUpperCase() + name.slice(1) : '',
            ...viewHelpers
        });
    } catch (error) {
        console.error('Tetterhoekje Feed Error:', error);
        res.status(500).send('Server Error');
    }
};

exports.postCreatePost = async (req, res) => {
    try {
        let defaultGroup = await FeedGroup.findOne({ where: { isTetterhoekje: true } });
        if (!defaultGroup) {
            defaultGroup = await ensureDefaultTetterGroup();
        }

        const groupId = req.body.groupId ? parseInt(req.body.groupId) : defaultGroup.id;
        const targetGroup = await FeedGroup.findByPk(groupId);

        if (!targetGroup || !targetGroup.isTetterhoekje) {
            return res.status(403).send('Ongeldige groep voor Tetterhoekje');
        }

        let content = req.body.content ? req.body.content.trim() : null;
        if (content) {
            content = sanitizeHtml(content, sanitizeOptions);
        }

        let attachments = [];
        if (req.files && req.files.length > 0) {
            attachments = req.files.map(file => ({
                path: '/feed_uploads/' + file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype
            }));
        }

        let poll = null;
        if (req.body.pollQuestion && req.body.pollOptions) {
            const options = Array.isArray(req.body.pollOptions) 
                ? req.body.pollOptions.map(o => o.trim()).filter(o => o !== '')
                : [req.body.pollOptions.trim()].filter(o => o !== '');

            if (options.length >= 2) {
                poll = [{
                    question: req.body.pollQuestion.trim(),
                    options: options.map(opt => ({ text: opt, votes: [] })),
                    allowMultiple: req.body.pollAllowMultiple === 'true' || req.body.pollAllowMultiple === true
                }];
            }
        }

        if (!content && attachments.length === 0 && !poll) {
            return res.redirect('/tetterhoekje?error=Bericht mag niet leeg zijn');
        }

        const newPost = await Post.create({
            content,
            attachments,
            poll,
            groupId: targetGroup.id,
            authorId: req.user.id
        });

        // Send Notifications via NotificationService
        (async () => {
            const plainContent = stripHtml(content || '');
            const messageData = {
                title: 'Nieuw Bericht in Het Tetterhoekje',
                body: `${req.user.username}: ${plainContent.substring(0, 40)}${plainContent.length > 40 ? '...' : ''}`,
                url: targetGroup ? `/tetterhoekje/group/${targetGroup.slug}` : '/tetterhoekje',
                type: 'newPost',
                isTetterhoekje: true
            };

            // 1. Group Notification
            await NotificationService.sendGroupNotification(targetGroup.id, messageData);

            // 2. Mention Notifications
            const mentionedUsernames = extractMentions(content);
            if (mentionedUsernames.length > 0) {
                const mentionedUsers = await User.findAll({
                    where: {
                        username: { [Op.in]: mentionedUsernames },
                        id: { [Op.ne]: req.user.id },
                        role: { [Op.in]: ['kookmoeke', 'admin'] }
                    }
                });

                const mentionMessage = {
                    title: 'Je bent genoemd in een bericht',
                    body: `${req.user.username} noemde je: "${plainContent.substring(0, 30)}..."`,
                    url: targetGroup ? `/tetterhoekje/group/${targetGroup.slug}#post-${newPost.id}` : `/tetterhoekje#post-${newPost.id}`,
                    type: 'mention',
                    isTetterhoekje: true
                };

                await Promise.allSettled(mentionedUsers.map(u => NotificationService.sendIndividualNotification(u, mentionMessage)));
            }
        })().catch(err => console.error('Tetterhoekje Post Notification Error:', err));

        res.redirect('/tetterhoekje' + (targetGroup ? '/group/' + targetGroup.slug : ''));
    } catch (error) {
        console.error('Tetterhoekje Post Error:', error);
        res.redirect('/tetterhoekje?error=Kon bericht niet plaatsen');
    }
};

exports.postCreateEvent = async (req, res) => {
    try {
        const { name, year, description, startDate, endDate } = req.body;
        if (!name) {
            return res.redirect('/tetterhoekje?error=Naam van het event is verplicht.');
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
        let bannerImage = null;
        if (req.file) {
            bannerImage = '/feed_uploads/' + req.file.filename;
        }

        const newEvent = await FeedGroup.create({
            name: name.trim(),
            slug,
            year: year ? year.trim() : null,
            description: description ? description.trim() : null,
            isEvent: true,
            isTetterhoekje: true,
            creatorId: req.user.id,
            startDate: startDate || null,
            endDate: endDate || null,
            bannerImage
        });

        res.redirect('/tetterhoekje/group/' + newEvent.slug);
    } catch (error) {
        console.error('Tetterhoekje Create Event Error:', error);
        res.redirect('/tetterhoekje?error=Kon event niet aanmaken.');
    }
};
