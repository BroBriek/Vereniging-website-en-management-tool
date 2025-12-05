const { Post, Comment, User, PostResponse } = require('../models');
const path = require('path');
const webpush = require('web-push');

// Configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:admin@chirosite.local',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
}

exports.getFeed = async (req, res) => {
    try {
        const posts = await Post.findAll({
            include: [
                { model: User, as: 'author', attributes: ['id', 'username'] },
                {
                    model: Comment,
                    as: 'comments',
                    include: [
                        { model: User, as: 'author', attributes: ['id', 'username'] },
                        { 
                            model: Comment, 
                            as: 'replies',
                            include: [{ model: User, as: 'author', attributes: ['id', 'username'] }]
                        }
                    ],
                    where: { parentId: null }, // Fetch top-level comments only (replies are nested)
                    required: false
                },
                {
                    model: PostResponse,
                    as: 'responses',
                    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
                }
            ],
            order: [['createdAt', 'DESC'], [{ model: Comment, as: 'comments' }, 'createdAt', 'ASC']]
        });
        
        res.render('feed/index', { title: 'Leidingshoekje', posts, user: req.user });
    } catch (error) {
        console.error('Feed Error:', error);
        res.status(500).send('Server Error');
    }
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

        const newPost = await Post.create({
            content,
            attachments,
            poll,
            form,
            authorId: req.user.id
        });

        // Send Push Notifications (Async)
        (async () => {
            try {
                const users = await User.findAll();
                const payload = JSON.stringify({
                    title: 'Nieuw Bericht in Leidingshoekje',
                    body: `${req.user.username}: ${content.substring(0, 40)}${content.length > 40 ? '...' : ''}`,
                });

                for (const user of users) {
                    if (user.pushSubscriptions && Array.isArray(user.pushSubscriptions)) {
                        let subChanged = false;
                        // Iterate backwards to allow removal
                        for (let i = user.pushSubscriptions.length - 1; i >= 0; i--) {
                            const sub = user.pushSubscriptions[i];
                            try {
                                await webpush.sendNotification(sub, payload);
                            } catch (err) {
                                if (err.statusCode === 410 || err.statusCode === 404) {
                                    // Subscription is dead, remove it
                                    user.pushSubscriptions.splice(i, 1);
                                    subChanged = true;
                                }
                            }
                        }
                        if (subChanged) {
                            // Re-assign to trigger update
                            user.pushSubscriptions = [...user.pushSubscriptions]; 
                            user.changed('pushSubscriptions', true);
                            await user.save();
                        }
                    }
                }
            } catch (error) {
                console.error('Notification Error:', error);
            }
        })();

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

        // Send Notification if it's a reply
        if (parentId) {
            const parentComment = await Comment.findByPk(parentId, {
                include: [{ model: User, as: 'author' }]
            });

            if (parentComment && parentComment.author && parentComment.author.id !== req.user.id) {
                const targetUser = parentComment.author;
                const payload = JSON.stringify({
                    title: 'Nieuwe reactie',
                    body: `${req.user.username} reageerde op je: "${content.substring(0, 30)}..."`
                });

                if (targetUser.pushSubscriptions && Array.isArray(targetUser.pushSubscriptions)) {
                    let subChanged = false;
                    for (let i = targetUser.pushSubscriptions.length - 1; i >= 0; i--) {
                        const sub = targetUser.pushSubscriptions[i];
                        try {
                            await webpush.sendNotification(sub, payload);
                        } catch (err) {
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                targetUser.pushSubscriptions.splice(i, 1);
                                subChanged = true;
                            }
                        }
                    }
                    if (subChanged) {
                        targetUser.pushSubscriptions = [...targetUser.pushSubscriptions];
                        targetUser.changed('pushSubscriptions', true);
                        await targetUser.save();
                    }
                }
            }
        }

        res.redirect('/feed');
    } catch (error) {
        console.error('Comment Error:', error);
        res.redirect('/feed');
    }
};

exports.postResponse = async (req, res) => {

    try {
        const { postId, type, data } = req.body;
        const userId = req.user.id;

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

        res.redirect('/feed');
    } catch (error) {
        console.error('Response Error:', error);
        res.redirect('/feed?error=Fout bij verzenden');
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

        // Manually delete dependencies to avoid SQLite FK issues
        await Promise.all([
            Comment.destroy({ where: { postId: post.id } }),
            PostResponse.destroy({ where: { postId: post.id } })
        ]);

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
        res.redirect('/feed?success=Post bijgewerkt');
    } catch (error) {
        console.error('Update Post Error:', error);
        res.redirect('/feed?error=Kon post niet bijwerken');
    }
};

