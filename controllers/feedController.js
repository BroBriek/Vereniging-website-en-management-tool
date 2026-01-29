const { Post, Comment, User, PostResponse, Like, FeedGroup, UserGroupAccess } = require('../models');
const quoteController = require('./quoteController');
const path = require('path');
const { Op } = require('sequelize');
const NotificationService = require('../services/NotificationService');

// View Helpers
const getAvatarColor = (username) => {
    if (!username) return '#db3e41';
    const vibrantColors = ['#f1c40f', '#2ecc71', '#e67e22', '#e74c3c', '#3498db', '#9b59b6', '#1abc9c', '#d35400'];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return vibrantColors[Math.abs(hash) % vibrantColors.length];
};

const getInitials = (username) => {
    if (!username) return '?';
    return username.substring(0, 2).toUpperCase();
};

const highlightMentions = (text) => {
    if (!text) return '';
    // Match HTML tags OR mentions. Capture group 1 is tag, group 2 is username.
    return text.replace(/(<[^>]+>)|@(\w+)/g, (match, tag, username) => {
        if (tag) return tag; // Return HTML tags unchanged
        const capitalized = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
        return `<span class="text-primary fw-bold">@${capitalized}</span>`;
    });
};

const stripHtml = (text) => {
    return (text || '').replace(/<[^>]+>/g, '');
};

const viewHelpers = { getAvatarColor, getInitials, highlightMentions };

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
        
        const whereClause = {
            isActive: true,
            username: { [Op.ne]: 'admin' }
        };

        if (query.length > 0) {
            whereClause.username[Op.like] = `%${query}%`;
        }

        const users = await User.findAll({
            where: whereClause,
            attributes: ['id', 'username'],
            limit: 5,
            order: [['username', 'ASC']]
        });
        res.json(users);
    } catch (error) {
        console.error('Search Users Error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};

exports.getFeed = async (req, res) => {
    try {
        const quoteOfTheMonth = await quoteController.getQuoteOfTheMonth();
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

        const limit = parseInt(process.env.FEED_PAGINATION_LIMIT) || 10;
        const offset = parseInt(req.query.offset) || 0;

        // 1. Fetch Posts (without nested comments to avoid limit/offset issues and messy includes)
        const postsData = await Post.findAll({
            where: activeGroup ? { groupId: activeGroup.id } : {},
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
            order: [['createdAt', 'ASC']] // Chronological order
        });

        // 3. Build Comment Trees
        const commentMap = {};
        const commentsByPost = {};
        
        postIds.forEach(id => { commentsByPost[id] = []; });
        
        // First pass: map all comments and initialize replies
        const plainComments = allComments.map(c => {
            const json = c.toJSON();
            json.replies = [];
            commentMap[json.id] = json;
            return json;
        });

        // Second pass: build hierarchy
        plainComments.forEach(c => {
            if (c.parentId && commentMap[c.parentId]) {
                commentMap[c.parentId].replies.push(c);
            } else {
                if (commentsByPost[c.postId]) {
                    commentsByPost[c.postId].push(c);
                }
            }
        });

        // Attach comments to posts
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

        res.render('feed/index', { 
            title: 'Leidingshoekje', 
            posts, 
            user: req.user, 
            groups: allGroups, 
            activeGroup,
            limit, // Pass limit to view for initial button state
            quoteOfTheMonth,
            ...viewHelpers
        });
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
    return [...new Set(matches.map(m => m.substring(1).toLowerCase()))]; // Remove @ and unique
};

exports.postCreatePost = async (req, res) => {
    try {
        const { content, form_schema } = req.body;
        const attachments = req.files ? req.files.map(f => ({
            path: `/feed_uploads/${f.filename}`,
            originalName: f.originalname,
            mimeType: f.mimetype
        })) : [];

        let poll = null;
        
        // Handle Multiple Polls (New Format)
        if (req.body.polls) {
            // req.body.polls might be an object with numeric keys if sent as polls[0]..., or array
            const pollsInput = typeof req.body.polls === 'object' ? Object.values(req.body.polls) : req.body.polls;
            
            if (Array.isArray(pollsInput)) {
                poll = pollsInput.map(p => {
                    const opts = (Array.isArray(p.options) ? p.options : (p.options ? [p.options] : [])).filter(o => o && o.trim() !== "");
                    if (opts.length > 0 && p.question) {
                        return {
                            question: p.question,
                            options: opts,
                            allowMultiple: p.multiple === 'on' || p.multiple === 'true'
                        };
                    }
                    return null;
                }).filter(p => p !== null);
                
                if (poll.length === 0) poll = null;
            }
        } 
        // Fallback for Legacy/Single Poll
        else if (req.body.poll_question && req.body.poll_options) {
            const options = (Array.isArray(req.body.poll_options) ? req.body.poll_options : [req.body.poll_options]).filter(o => o.trim() !== "");
            if (options.length > 0) {
                // Store as array for consistency
                poll = [{
                    question: req.body.poll_question,
                    options: options,
                    allowMultiple: req.body.poll_multiple === 'on'
                }];
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
            const plainContent = stripHtml(content);
            const messageData = {
                title: 'Nieuw Bericht in Leidingshoekje',
                body: `${req.user.username}: ${plainContent.substring(0, 40)}${plainContent.length > 40 ? '...' : ''}`,
                url: group ? `/feed/group/${group.slug}` : '/feed',
                type: 'newPost'
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
                    body: `${req.user.username} noemde je: "${stripHtml(content).substring(0, 30)}..."`,
                    url: group ? `/feed/group/${group.slug}#post-${newPost.id}` : `/feed#post-${newPost.id}`,
                    type: 'mention'
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
            let notifiedUserIds = new Set();

            // 1. Reply to Comment
            if (parentId) {
                const parentComment = await Comment.findByPk(parentId, {
                    include: [{ model: User, as: 'author' }]
                });

                if (parentComment && parentComment.author && parentComment.author.id !== req.user.id) {
                    const targetUser = parentComment.author;
                                        const messageData = {
                                            title: 'Nieuwe reactie',
                                            body: `${req.user.username} reageerde op je: "${stripHtml(content).substring(0, 30)}"...`,
                    
                        url: group ? `/feed/group/${group.slug}#post-${postId}` : `/feed#post-${postId}`,
                        type: 'comment'
                    };
                    await NotificationService.sendIndividualNotification(targetUser, messageData);
                    notifiedUserIds.add(targetUser.id);
                }
            }

            // 2. Comment on Post (Notify Post Author)
            if (post && post.authorId !== req.user.id) {
                if (!notifiedUserIds.has(post.authorId)) {
                    const postAuthor = await User.findByPk(post.authorId);
                    if (postAuthor) {
                         const messageData = {
                            title: 'Nieuwe reactie op je bericht',
                            body: `${req.user.username} reageerde op je bericht.`,
                            url: group ? `/feed/group/${group.slug}#post-${postId}` : `/feed#post-${postId}`,
                            type: 'comment'
                        };
                        await NotificationService.sendIndividualNotification(postAuthor, messageData);
                        notifiedUserIds.add(postAuthor.id);
                    }
                }
            }

            // 3. Mention Notifications
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
                    body: `${req.user.username} noemde je: "${stripHtml(content).substring(0, 30)}..."`,
                    url: group ? `/feed/group/${group.slug}#post-${postId}` : `/feed#post-${postId}`,
                    type: 'mention'
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

            const pollIndex = data.pollIndex !== undefined ? parseInt(data.pollIndex) : 0;

            // Remove existing response for this specific poll/user to allow "revoting"
            // Since we store responses as individual rows, we need to find the one matching the pollIndex
            const existingResponses = await PostResponse.findAll({
                where: { postId, userId, type: 'poll' }
            });

            for (const resp of existingResponses) {
                // If pollIndex is missing in data (legacy), assume 0
                const pIdx = (resp.data && resp.data.pollIndex !== undefined) ? resp.data.pollIndex : 0;
                if (pIdx === pollIndex) {
                    await resp.destroy();
                }
            }

            if (indices.length > 0) {
                await PostResponse.create({
                    postId,
                    userId,
                    type: 'poll',
                    data: { optionIndices: indices, pollIndex: pollIndex }
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
                 include: [{ model: User, as: 'user', attributes: ['username', 'profilePicture'] }]
             });
             const likeCount = likes.length;
             const likers = likes.map(l => l.user ? { username: l.user.username, profilePicture: l.user.profilePicture } : { username: 'Onbekend', profilePicture: null });
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

exports.toggleCommentLike = async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.id;

        const existingLike = await Like.findOne({
            where: { commentId, userId }
        });

        if (existingLike) {
            await existingLike.destroy();
        } else {
            await Like.create({ commentId, userId });
        }

        const comment = await Comment.findByPk(commentId, {
            include: [{ model: User, as: 'author' }]
        });
        
        if (comment) {
            const post = await Post.findByPk(comment.postId);
            let group = null;
            if (post && post.groupId) group = await FeedGroup.findByPk(post.groupId);

            // Send notification if liked (not unliked) and not own comment
            if (!existingLike && comment.author && comment.author.id !== req.user.id) {
                 const messageData = {
                    title: 'Nieuwe like',
                    body: `${req.user.username} vond je reactie leuk: "${stripHtml(comment.content).substring(0, 30)}..."`,
                    url: group ? `/feed/group/${group.slug}#post-${post.id}` : `/feed#post-${post.id}`,
                    type: 'reaction'
                };
                NotificationService.sendIndividualNotification(comment.author, messageData);
            }

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                 const likes = await Like.findAll({
                     where: { commentId },
                     include: [{ model: User, as: 'user', attributes: ['username', 'profilePicture'] }]
                 });
                 const likeCount = likes.length;
                 const likers = likes.map(l => l.user ? { username: l.user.username, profilePicture: l.user.profilePicture } : { username: 'Onbekend', profilePicture: null });
                 return res.json({ success: true, liked: !existingLike, count: likeCount, likers });
            }

            res.redirect((post && post.groupId && group) ? ('/feed/group/' + group.slug + '#post-' + post.id) : ('/feed#post-' + post.id));
        } else {
             if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                 return res.json({ success: false });
             }
             res.redirect('/feed');
        }
    } catch (error) {
        console.error('Toggle Comment Like Error:', error);
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
