const { Post, Comment, User, PostResponse, Like, FeedGroup, UserGroupAccess } = require('../models');
const path = require('path');
const { Op } = require('sequelize');
const NotificationService = require('../services/NotificationService');

const getAccessibleGroups = async (user) => {
    if (user.role === 'admin') {
        return await FeedGroup.findAll({ order: [['year', 'DESC'], ['name', 'ASC']] });
    }
    const groups = await FeedGroup.findAll({
        include: [{ model: User, as: 'members', where: { id: user.id }, required: true }],
        order: [['year', 'DESC'], ['name', 'ASC']]
    });
    return groups;
};

const ensureAccessToGroup = async (user, group) => {
    if (!group) return false;
    if (user.role === 'admin') return true;
    const count = await UserGroupAccess.count({ where: { userId: user.id, feedGroupId: group.id } });
    return count > 0;
};

exports.searchUsers = async (req, res) => {
    try {
        const query = req.query.q || '';
        if (query.length < 1) return res.json([]);
        
        const users = await User.findAll({
            where: {
                username: { 
                    [Op.like]: `%${query}%`,
                    [Op.ne]: 'Admin'
                }
            },
            attributes: ['id', 'username'],
            limit: 5
        });
        res.json(users);
    } catch (error) {
        console.error('Search Users Error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};

exports.getFeed = async (req, res) => {
    try {
        const slug = req.params.slug || null;
        const allGroups = await getAccessibleGroups(req.user);
        let activeGroup = null;
        if (slug) {
            activeGroup = await FeedGroup.findOne({ where: { slug } });
            const allowed = await ensureAccessToGroup(req.user, activeGroup);
            if (!allowed) return res.status(403).send('Geen toegang');
        } else {
            activeGroup = allGroups[0] || null;
        }
        const posts = await Post.findAll({
            where: activeGroup ? { groupId: activeGroup.id } : {},
            include: [
                { model: User, as: 'author', attributes: ['id', 'username'] },
                { model: Like, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username'] }] },
                { model: Comment, as: 'comments', include: [
                    { model: User, as: 'author', attributes: ['id', 'username'] },
                    { model: Comment, as: 'replies', include: [{ model: User, as: 'author', attributes: ['id', 'username'] }] }
                ], where: { parentId: null }, required: false },
                { model: PostResponse, as: 'responses', include: [{ model: User, as: 'user', attributes: ['id', 'username'] }] }
            ],
            order: [['createdAt', 'DESC'], [{ model: Comment, as: 'comments' }, 'createdAt', 'ASC']]
        });
        res.render('feed/index', { title: 'Leidingshoekje', posts, user: req.user, groups: allGroups, activeGroup });
    } catch (error) {
        console.error('Feed Error:', error);
        res.status(500).send('Server Error');
    }
};

// Helper to find mentions
const extractMentions = (text) => {
    if (!text) return [];
    const matches = text.match(/@(\w+)/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.substring(1)))]; // Remove @ and unique
};

exports.postCreatePost = async (req, res) => {
    try {
        const { content, poll_question, poll_options, poll_multiple, form_schema } = req.body;
        const attachments = req.files ? req.files.map(f => ({
            path: `/feed_uploads/${f.filename}`,
            originalName: f.originalname,
            mimeType: f.mimetype
        })) : [];

        let poll = null;
        if (poll_question && poll_options) {
            // Filter empty options
            const options = (Array.isArray(poll_options) ? poll_options : [poll_options]).filter(o => o.trim() !== "");
            if (options.length > 0) {
                poll = {
                    question: poll_question,
                    options: options,
                    allowMultiple: poll_multiple === 'on' // Checkbox returns 'on' if checked
                };
            }
        }

        let form = null;
        if (form_schema) {
            try {
                form = JSON.parse(form_schema);
            } catch (e) {
                console.error("Invalid form JSON", e);
            }
        }

        const groupId = req.body.groupId ? parseInt(req.body.groupId) : null;
        let group = null;
        if (groupId) {
            group = await FeedGroup.findByPk(groupId);
            const allowed = await ensureAccessToGroup(req.user, group);
            if (!allowed) return res.redirect('/feed?error=Geen toegang');
        }

        const newPost = await Post.create({ content, attachments, poll, form, authorId: req.user.id, groupId: group ? group.id : null });

        // Send Notifications via NotificationService
        (async () => {
            const messageData = {
                title: 'Nieuw Bericht in Leidingshoekje',
                body: `${req.user.username}: ${(content || '').substring(0, 40)}${(content && content.length > 40) ? '...' : ''}`,
                url: group ? `/feed/group/${group.slug}` : '/feed'
            };

            // 1. Group/Global Notification
            if (group) {
                await NotificationService.sendGroupNotification(group.id, messageData);
            } else {
                const allUsers = await User.findAll();
                await Promise.allSettled(allUsers.map(u => NotificationService.sendIndividualNotification(u, messageData)));
            }

            // 2. Mention Notifications
            const mentionedUsernames = extractMentions(content);
            if (mentionedUsernames.length > 0) {
                const mentionedUsers = await User.findAll({
                    where: {
                        username: { [Op.in]: mentionedUsernames },
                        id: { [Op.ne]: req.user.id } // Don't notify self
                    }
                });

                const mentionMessage = {
                    title: 'Je bent genoemd in een bericht',
                    body: `${req.user.username} noemde je: "${(content || '').substring(0, 30)}..."`,
                    url: group ? `/feed/group/${group.slug}#post-${newPost.id}` : `/feed#post-${newPost.id}`
                };

                await Promise.allSettled(mentionedUsers.map(u => NotificationService.sendIndividualNotification(u, mentionMessage)));
            }
        })();

        if (group) {
            return res.redirect('/feed/group/' + group.slug);
        }
        res.redirect('/feed');
    } catch (error) {
        console.error('Create Post Error:', error);
        res.redirect('/feed?error=Kon post niet aanmaken');
    }
};

exports.postComment = async (req, res) => {
    try {
        const { postId, content, parentId } = req.body;
        const comment = await Comment.create({
            content,
            postId,
            parentId: parentId || null,
            userId: req.user.id
        });

        const post = await Post.findByPk(postId);
        let group = null;
        if (post && post.groupId) group = await FeedGroup.findByPk(post.groupId);

        // Send Notification if it's a reply
        (async () => {
            if (parentId) {
                const parentComment = await Comment.findByPk(parentId, {
                    include: [{ model: User, as: 'author' }]
                });

                if (parentComment && parentComment.author && parentComment.author.id !== req.user.id) {
                    const targetUser = parentComment.author;
                    const messageData = {
                        title: 'Nieuwe reactie',
                        body: `${req.user.username} reageerde op je: "${content.substring(0, 30)}"...`,
                        url: group ? `/feed/group/${group.slug}#post-${postId}` : `/feed#post-${postId}`
                    };
                    NotificationService.sendIndividualNotification(targetUser, messageData);
                }
            }

            // Mention Notifications
            const mentionedUsernames = extractMentions(content);
            if (mentionedUsernames.length > 0) {
                const mentionedUsers = await User.findAll({
                    where: {
                        username: { [Op.in]: mentionedUsernames },
                        id: { [Op.ne]: req.user.id }
                    }
                });

                const mentionMessage = {
                    title: 'Je bent genoemd in een reactie',
                    body: `${req.user.username} noemde je: "${content.substring(0, 30)}..."`,
                    url: group ? `/feed/group/${group.slug}#post-${postId}` : `/feed#post-${postId}`
                };

                await Promise.allSettled(mentionedUsers.map(u => NotificationService.sendIndividualNotification(u, mentionMessage)));
            }
        })();

        if (!post) return res.redirect('/feed');
        const ok = await ensureAccessToGroup(req.user, group || null);
        if (!ok) return res.redirect('/feed');
        
        res.redirect(post.groupId && group ? '/feed/group/' + group.slug : '/feed');
    } catch (error) {
        console.error('Comment Error:', error);
        res.redirect('/feed');
    }
};

exports.postResponse = async (req, res) => {

    try {
        const { postId, type, data } = req.body;
        const userId = req.user.id;
        const post = await Post.findByPk(postId);
        let group = null;
        if (post && post.groupId) group = await FeedGroup.findByPk(post.groupId);
        const ok = await ensureAccessToGroup(req.user, group || null);
        if (!ok) return res.redirect('/feed');

        if (type === 'poll') {
            // data.optionIndex can be a single string/number OR an array of strings/numbers if multiple checkboxes checked
            // We standardize to array of integers
            let indices = [];
            if (Array.isArray(data.optionIndex)) {
                indices = data.optionIndex.map(i => parseInt(i));
            } else if (data.optionIndex !== undefined) {
                indices = [parseInt(data.optionIndex)];
            }

            // Remove existing response for this poll/user to allow "revoting"
            await PostResponse.destroy({
                where: { postId, userId, type: 'poll' }
            });

            if (indices.length > 0) {
                await PostResponse.create({
                    postId,
                    userId,
                    type: 'poll',
                    data: { optionIndices: indices }
                });
            }
        } else {
            // Form Response
            // Check if already responded? (Optional, let's limit to 1 per user for now)
             const existing = await PostResponse.findOne({
                where: { postId, userId, type: 'form' }
            });

            const responseData = typeof data === 'string' ? JSON.parse(data) : data;

            if (existing) {
                 await existing.update({ data: responseData });
            } else {
                await PostResponse.create({
                    postId,
                    userId,
                    type,
                    data: responseData
                });
            }
        }

        if (post && post.groupId && group) {
            return res.redirect('/feed/group/' + group.slug);
        }
        res.redirect('/feed');
    } catch (error) {
        console.error('Response Error:', error);
        res.redirect('/feed?error=Fout bij verzenden');
    }
};

exports.toggleLike = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;

        const existingLike = await Like.findOne({
            where: { postId, userId }
        });

        if (existingLike) {
            await existingLike.destroy();
        } else {
            await Like.create({ postId, userId });
        }

        // Return JSON if AJAX, otherwise redirect
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
             const likes = await Like.findAll({
                 where: { postId },
                 include: [{ model: User, as: 'user', attributes: ['username'] }]
             });
             const likeCount = likes.length;
             const likers = likes.map(l => l.user ? l.user.username : 'Onbekend');
             return res.json({ success: true, liked: !existingLike, count: likeCount, likers });
        }

        const post = await Post.findByPk(postId);
        let group = null;
        if (post && post.groupId) group = await FeedGroup.findByPk(post.groupId);
        res.redirect((post && post.groupId && group) ? ('/feed/group/' + group.slug + '#' + 'post-' + postId) : ('/feed#' + 'post-' + postId));
    } catch (error) {
        console.error('Toggle Like Error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server Error' });
        }
        res.redirect('/feed');
    }
};

exports.deletePost = async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id);
        if (!post) return res.redirect('/feed?error=Post niet gevonden');

        // Check ownership or admin
        if (post.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.redirect('/feed?error=Geen rechten');
        }

        await post.destroy();
        res.redirect('/feed?success=Post verwijderd');
    } catch (error) {
        console.error('Delete Post Error:', error);
        res.redirect('/feed?error=Kon post niet verwijderen');
    }
};

exports.updatePost = async (req, res) => {
    try {
        const { content } = req.body;
        const post = await Post.findByPk(req.params.id);
        if (!post) return res.redirect('/feed?error=Post niet gevonden');

        if (post.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.redirect('/feed?error=Geen rechten');
        }

        await post.update({ content });
        let group = null;
        if (post.groupId) group = await FeedGroup.findByPk(post.groupId);
        if (group) return res.redirect('/feed/group/' + group.slug + '?success=Post bijgewerkt');
        res.redirect('/feed?success=Post bijgewerkt');
    } catch (error) {
        console.error('Update Post Error:', error);
        res.redirect('/feed?error=Kon post niet bijwerken');
    }
};

exports.updateComment = async (req, res) => {
    try {
        const { content } = req.body;
        const comment = await Comment.findByPk(req.params.id);
        if (!comment) return res.redirect('/feed?error=Reactie niet gevonden');

        if (comment.userId !== req.user.id && req.user.role !== 'admin') {
            return res.redirect('/feed?error=Geen rechten');
        }

        await comment.update({ content });
        res.redirect('/feed?success=Reactie bijgewerkt');
    } catch (error) {
        console.error('Update Comment Error:', error);
        res.redirect('/feed?error=Kon reactie niet bijwerken');
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findByPk(req.params.id);
        if (!comment) return res.redirect('/feed?error=Reactie niet gevonden');

        if (comment.userId !== req.user.id && req.user.role !== 'admin') {
            return res.redirect('/feed?error=Geen rechten');
        }

        await comment.destroy();
        res.redirect('/feed?success=Reactie verwijderd');
    } catch (error) {
        console.error('Delete Comment Error:', error);
        res.redirect('/feed?error=Kon reactie niet verwijderen');
    }
};

exports.getGroupFiles = async (req, res) => {
    try {
        const slug = req.params.slug;
        const group = await FeedGroup.findOne({ where: { slug } });
        const allowed = await ensureAccessToGroup(req.user, group);
        if (!allowed) return res.status(403).send('Geen toegang');
        const posts = await Post.findAll({ where: { groupId: group.id } });
        const files = [];
        posts.forEach(p => {
            if (Array.isArray(p.attachments)) {
                p.attachments.forEach(a => files.push({ path: a.path, originalName: a.originalName, postId: p.id }));
            }
        });
        res.render('feed/files', { title: 'Bestanden', files, group, user: req.user });
    } catch (error) {
        console.error('Files Error:', error);
        res.status(500).send('Server Error');
    }
};
