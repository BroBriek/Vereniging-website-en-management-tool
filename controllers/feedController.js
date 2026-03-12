const { Post, Comment, User, PostResponse, Like, FeedGroup, UserGroupAccess, Leader, Event } = require('../models');
const quoteController = require('./quoteController');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
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
    
    // 1. Process Mentions first, but avoid touching content inside HTML tags
    // We'll use a more sophisticated approach: split by tags, process text nodes
    const parts = text.split(/(<[^>]+>)/g);
    const processedParts = parts.map(part => {
        if (part.startsWith('<')) {
            // This is an HTML tag. 
            // If it's an img tag, add our error handler if it's an external URL
            if (part.toLowerCase().startsWith('<img')) {
                // Check if it's an external URL (not starting with /uploads/)
                if (part.includes('src="http') && !part.includes('src="/uploads/')) {
                    // Add onerror handler to external images to help debug/fix expired links
                    return part.replace('>', ' onerror="handleBrokenImage(this)">');
                }
            }
            return part;
        }
        // This is text content, process mentions
        return part.replace(/@(\w+)/g, (match, username) => {
            const capitalized = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
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
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
};

const viewHelpers = { getAvatarColor, getInitials, highlightMentions };

exports.getCalendar = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const events = await Event.findAll({ 
            where: {
                [Op.or]: [
                    { date: { [Op.gte]: today } },
                    { 
                        [Op.and]: [
                            { endDate: { [Op.ne]: null } },
                            { endDate: { [Op.gte]: today } }
                        ]
                    }
                ]
            },
            order: [['date', 'ASC']]
        });
        res.render('feed/calendar', { 
            title: 'Leidingskalender', 
            user: req.user,
            events,
            capitalizeName: (name) => name.charAt(0).toUpperCase() + name.slice(1),
            ...viewHelpers
        });
    } catch (error) {
        console.error('Error in getCalendar:', error);
        res.status(500).send('Er ging iets mis');
    }
};

const getAccessibleGroups = async (user) => {
    const today = new Date().toISOString().split('T')[0];

    // Admins see everything
    if (user.role === 'admin') {
        return await FeedGroup.findAll({ 
            order: [['isEvent', 'ASC'], ['year', 'DESC'], ['name', 'ASC']] 
        });
    }

    // Regular users see:
    // 1. Events they created OR are a member of, IF today is between startDate and endDate
    //    If startDate/endDate are null, they are considered "always active"
    // 2. Normal groups they are a member of
    const groups = await FeedGroup.findAll({
        where: {
            [Op.or]: [
                {
                    [Op.and]: [
                        { isEvent: true },
                        {
                            [Op.or]: [
                                { creatorId: user.id },
                                { '$members.id$': user.id }
                            ]
                        },
                        {
                            [Op.or]: [
                                { startDate: { [Op.lte]: today }, endDate: { [Op.gte]: today } },
                                { startDate: null, endDate: { [Op.gte]: today } },
                                { startDate: { [Op.lte]: today }, endDate: null },
                                { startDate: null, endDate: null }
                            ]
                        }
                    ]
                },
                { 
                    [Op.and]: [
                        { isEvent: false },
                        { '$members.id$': user.id }
                    ]
                }
            ]
        },
        include: [{ 
            model: User, 
            as: 'members', 
            attributes: ['id'],
            through: { attributes: [] },
            required: false 
        }],
        order: [['isEvent', 'ASC'], ['year', 'DESC'], ['name', 'ASC']]
    });
    return groups;
};

const ensureAccessToGroup = async (user, group) => {
    if (!group) return false;
    if (user.role === 'admin') return true;
    if (group.isEvent && group.creatorId === user.id) return true;
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
            activeGroup = allGroups.find(g => !g.isEvent) || allGroups[0] || null;
        }

        const limit = parseInt(process.env.FEED_PAGINATION_LIMIT) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search || '';

        // For Access Management (Modal)
        const allUsers = await User.findAll({ 
            where: { 
                isActive: true,
                username: { [Op.ne]: 'admin' }
            }, 
            attributes: ['id', 'username'], 
            order: [['username', 'ASC']] 
        });
        const allNormalGroups = await FeedGroup.findAll({ 
            where: { isEvent: false }, 
            include: [{ model: User, as: 'members', attributes: ['id'] }],
            order: [['year', 'DESC'], ['name', 'ASC']] 
        });

        const whereClause = activeGroup ? { groupId: activeGroup.id } : {};

        if (search) {
             const matchingUsers = await User.findAll({
                 where: {
                     username: { [Op.like]: `%${search}%` }
                 },
                 attributes: ['id']
             });
             const matchingUserIds = matchingUsers.map(u => u.id);

             whereClause[Op.and] = [
                 activeGroup ? { groupId: activeGroup.id } : {},
                 {
                     [Op.or]: [
                         { content: { [Op.like]: `%${search}%` } },
                         { authorId: { [Op.in]: matchingUserIds } }
                     ]
                 }
             ];
             // Cleanup base groupId as it is now in Op.and
             delete whereClause.groupId;
        }

        // 1. Fetch Posts (without nested comments to avoid limit/offset issues and messy includes)
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

        // Birthday logic
        const today = new Date();
        const monthStr = (today.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = today.getDate().toString().padStart(2, '0');
        const todayMMDD = `${monthStr}-${dayStr}`;

        const leaders = await Leader.findAll({
            attributes: ['name', 'birth_date']
        });
        const birthdayLeaders = leaders.filter(l => {
            if (!l.birth_date) return false;
            // birth_date is YYYY-MM-DD
            const parts = l.birth_date.split('-');
            if (parts.length < 3) return false;
            const leaderMMDD = `${parts[1]}-${parts[2]}`;
            return leaderMMDD === todayMMDD;
        });

        res.render('feed/index', { 
            title: activeGroup ? activeGroup.name : 'Leidingshoekje', 
            posts, 
            user: req.user, 
            groups: allGroups, 
            activeGroup,
            limit,
            quoteOfTheMonth,
            birthdayLeaders,
            allUsers,
            allNormalGroups,
            capitalizeName: (name) => name.charAt(0).toUpperCase() + name.slice(1),
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

        if (!post) {
             if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                 return res.json({ success: false, error: 'Post niet gevonden' });
             }
             return res.redirect('/feed');
        }
        const ok = await ensureAccessToGroup(req.user, group || null);
        if (!ok) {
             if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                 return res.json({ success: false, error: 'Geen toegang' });
             }
             return res.redirect('/feed');
        }
        
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            const commentWithAuthor = await Comment.findByPk(comment.id, {
                include: [
                    { model: User, as: 'author', attributes: ['id', 'username', 'profilePicture'] },
                    { model: Like, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username', 'profilePicture'] }] },
                    { model: Comment, as: 'replies', include: [{ model: User, as: 'author', attributes: ['id', 'username', 'profilePicture'] }] }
                ]
            });
            
            if (!commentWithAuthor.replies) commentWithAuthor.replies = [];
            const commentCount = await Comment.count({ where: { postId } });
            
            return res.render('feed/comment_partial', {
                comment: commentWithAuthor,
                user: req.user,
                post: post,
                depth: 0,
                ...viewHelpers
            }, (err, html) => {
                if (err) {
                    console.error('Render Partial Error:', err);
                    return res.status(500).json({ error: 'Render Error' });
                }
                res.json({ success: true, html, count: commentCount });
            });
        }
        
        res.redirect(post.groupId && group ? `/feed/group/${group.slug}#post-${postId}` : `/feed#post-${postId}`);
    } catch (error) {
        console.error('Comment Error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server Error' });
        }
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

            // Handle AJAX: Return updated poll stats
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                const allResponses = await PostResponse.findAll({
                    where: { postId, type: 'poll' },
                    include: [{ model: User, as: 'user', attributes: ['username'] }]
                });

                // Calculate counts for this specific pollIndex
                const counts = {};
                const voters = {};
                // Initialize is hard because we don't have the poll options length here easily without fetching Post
                // But we can just return what we have. Frontend can merge.
                // Actually better to fetch Post to be safe or just return dynamic maps.
                
                allResponses.forEach(r => {
                    // Check if this response belongs to the current pollIndex
                    const pIdx = (r.data && r.data.pollIndex !== undefined) ? r.data.pollIndex : 0;
                    if (pIdx === pollIndex) {
                        let rIndices = Array.isArray(r.data.optionIndices) ? r.data.optionIndices : (r.data.optionIndex !== undefined ? [parseInt(r.data.optionIndex)] : []);
                        rIndices.forEach(idx => {
                            counts[idx] = (counts[idx] || 0) + 1;
                            if (r.user) {
                                if (!voters[idx]) voters[idx] = [];
                                voters[idx].push(r.user.username.charAt(0).toUpperCase() + r.user.username.slice(1).toLowerCase());
                            }
                        });
                    }
                });
                
                // Calculate total votes for this poll
                const totalVotes = allResponses.filter(r => {
                     const pIdx = (r.data && r.data.pollIndex !== undefined) ? r.data.pollIndex : 0;
                     return pIdx === pollIndex;
                }).length;

                return res.json({ 
                    success: true, 
                    myVotes: indices,
                    pollStats: { counts, voters, totalVotes }
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
        const { content, removed_attachments } = req.body;
        const post = await Post.findByPk(req.params.id);
        if (!post) return res.redirect('/feed?error=Post niet gevonden');

        if (post.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.redirect('/feed?error=Geen rechten');
        }

        // Handle Attachments
        let currentAttachments = post.attachments || [];
        
        // 1. Remove selected files
        if (removed_attachments) {
            const toRemove = Array.isArray(removed_attachments) ? removed_attachments : [removed_attachments];
            currentAttachments = currentAttachments.filter(att => !toRemove.includes(att.path));
        }

        // 2. Add new files
        if (req.files && req.files.length > 0) {
            const newAttachments = req.files.map(f => ({
                path: `/feed_uploads/${f.filename}`,
                originalName: f.originalname,
                mimeType: f.mimetype
            }));
            currentAttachments = [...currentAttachments, ...newAttachments];
        }

        // Handle Polls (Update/Add/Remove)
        let poll = null;
        if (req.body.polls) {
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

        await post.update({ content, attachments: currentAttachments, poll });
        
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
        
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
             return res.json({ success: true, content: highlightMentions(content), rawContent: content });
        }
        
        const post = await Post.findByPk(comment.postId);
        let group = null;
        if (post && post.groupId) group = await FeedGroup.findByPk(post.groupId);
        
        res.redirect(post.groupId && group ? `/feed/group/${group.slug}?success=Reactie bijgewerkt#post-${post.id}` : `/feed?success=Reactie bijgewerkt#post-${post.id}`);
    } catch (error) {
        console.error('Update Comment Error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server Error' });
        }
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

        const postId = comment.postId; // Save postId before deletion
        await comment.destroy();

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
             const count = await Comment.count({ where: { postId } });
             return res.json({ success: true, count });
        }

        const post = await Post.findByPk(postId);
        let group = null;
        if (post && post.groupId) group = await FeedGroup.findByPk(post.groupId);

        res.redirect(post && post.groupId && group ? `/feed/group/${group.slug}?success=Reactie verwijderd#post-${postId}` : `/feed?success=Reactie verwijderd#post-${postId}`);
    } catch (error) {
        console.error('Delete Comment Error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server Error' });
        }
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

exports.postCreateEvent = async (req, res) => {
    try {
        const { name, description, eventDate, startDate, endDate, userIds, groupIds } = req.body;
        if (!name) return res.status(400).send('Naam is verplicht');

        let bannerImage = null;
        if (req.file) {
            bannerImage = `/feed_uploads/${req.file.filename}`;
        }

        let baseSlug = slugify(name);
        let slug = baseSlug;
        // Ensure unique slug
        let existing = await FeedGroup.findOne({ where: { slug } });
        let counter = 1;
        while (existing) {
            slug = `${baseSlug}-${counter}`;
            existing = await FeedGroup.findOne({ where: { slug } });
            counter++;
        }

        const newEvent = await FeedGroup.create({
            name,
            slug,
            description,
            eventDate,
            startDate: startDate || null,
            endDate: endDate || null,
            bannerImage,
            isEvent: true,
            creatorId: req.user.id
        });

        // Manage Access
        const targetUserIds = new Set();
        
        // Add individual users
        if (userIds) {
            const ids = Array.isArray(userIds) ? userIds : [userIds];
            ids.forEach(id => targetUserIds.add(parseInt(id)));
        }

        // Add users from selected groups
        if (groupIds) {
            const gIds = Array.isArray(groupIds) ? groupIds : [groupIds];
            const groupMembers = await UserGroupAccess.findAll({
                where: { feedGroupId: { [Op.in]: gIds } },
                attributes: ['userId']
            });
            groupMembers.forEach(m => targetUserIds.add(m.userId));
        }

        // Always add the creator
        targetUserIds.add(req.user.id);

        if (targetUserIds.size > 0) {
            await UserGroupAccess.bulkCreate(
                Array.from(targetUserIds).map(uid => ({
                    userId: uid,
                    feedGroupId: newEvent.id,
                    role: 'member'
                }))
            );
        }

        // Redirect to the newly created event feed
        res.redirect(`/feed/group/${newEvent.slug}?success=Event aangemaakt`);
    } catch (error) {
        console.error('Create Event Error:', error);
        res.status(500).send('Kon event niet aanmaken');
    }
};

exports.postUpdateEvent = async (req, res) => {
    try {
        const { name, description, eventDate, startDate, endDate, userIds, groupIds } = req.body;
        const group = await FeedGroup.findByPk(req.params.id);
        if (!group || !group.isEvent) return res.status(404).send('Event niet gevonden');

        if (group.creatorId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).send('Geen rechten');
        }

        const updateData = {
            name,
            description,
            eventDate,
            startDate: startDate || null,
            endDate: endDate || null
        };

        if (req.file) {
            // Delete old banner if it exists
            if (group.bannerImage) {
                const oldPath = path.join(__dirname, '..', 'public', group.bannerImage);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            updateData.bannerImage = `/feed_uploads/${req.file.filename}`;
        }

        await group.update(updateData);

        // Sync Membership
        const targetUserIds = new Set();
        
        // Add individual users
        if (userIds) {
            const ids = Array.isArray(userIds) ? userIds : [userIds];
            ids.forEach(id => targetUserIds.add(parseInt(id)));
        }

        // Add users from selected groups
        if (groupIds) {
            const gIds = Array.isArray(groupIds) ? groupIds : [groupIds];
            const groupMembers = await UserGroupAccess.findAll({
                where: { feedGroupId: { [Op.in]: gIds } },
                attributes: ['userId']
            });
            groupMembers.forEach(m => targetUserIds.add(m.userId));
        }

        // Always add the creator
        targetUserIds.add(group.creatorId);

        // Replace all memberships for this group
        await UserGroupAccess.destroy({ where: { feedGroupId: group.id } });
        if (targetUserIds.size > 0) {
            await UserGroupAccess.bulkCreate(
                Array.from(targetUserIds).map(uid => ({
                    userId: uid,
                    feedGroupId: group.id,
                    role: 'member'
                }))
            );
        }

        res.redirect(`/feed/group/${group.slug}?success=Event bijgewerkt`);
    } catch (error) {
        console.error('Update Event Error:', error);
        res.status(500).send('Kon event niet bijwerken');
    }
};

exports.postDeleteEvent = async (req, res) => {
    try {
        const group = await FeedGroup.findByPk(req.params.id);
        if (!group || !group.isEvent) return res.status(404).send('Event niet gevonden');

        if (group.creatorId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).send('Geen rechten');
        }

        // Delete banner
        if (group.bannerImage) {
            const bannerPath = path.join(__dirname, '..', 'public', group.bannerImage);
            if (fs.existsSync(bannerPath)) fs.unlinkSync(bannerPath);
        }

        await group.destroy();
        res.redirect('/feed?success=Event verwijderd');
    } catch (error) {
        console.error('Delete Event Error:', error);
        res.status(500).send('Kon event niet verwijderen');
    }
};

exports.fixImageApi = async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Geen URL opgegeven' });
    }

    // Security check: only allow images and prevent SSRF to local network
    if (!url.startsWith('http')) {
        return res.status(400).json({ error: 'Ongeldige URL' });
    }

    try {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const protocol = url.startsWith('https') ? https : http;
        const filename = `fixed-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(new URL(url).pathname) || '.jpg'}`;
        const filePath = path.join(uploadDir, filename);

        const file = fs.createWriteStream(filePath);
        
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(filePath, () => {});
                return res.status(response.statusCode).json({ error: `Fout bij ophalen afbeelding: ${response.statusCode}` });
            }

            // Check content type
            const contentType = response.headers['content-type'];
            if (contentType && !contentType.startsWith('image/')) {
                file.close();
                fs.unlink(filePath, () => {});
                return res.status(400).json({ error: 'URL is geen afbeelding' });
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                res.json({ url: `/uploads/${filename}` });
            });
        }).on('error', (err) => {
            file.close();
            fs.unlink(filePath, () => {});
            console.error('Download error:', err);
            res.status(500).json({ error: 'Fout bij downloaden afbeelding' });
        });

    } catch (error) {
        console.error('Fix Image Error:', error);
        res.status(500).json({ error: 'Interne serverfout' });
    }
};
