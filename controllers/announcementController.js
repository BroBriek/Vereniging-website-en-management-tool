const { Announcement, User } = require('../models');
const NotificationService = require('../services/NotificationService');
const sanitizeHtml = require('sanitize-html');

const sanitizeRichText = (html) => {
    if (!html) return '';
    return sanitizeHtml(html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'iframe' ]),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            'img': [ 'src', 'alt', 'width', 'height', 'style', 'class' ],
            'iframe': [ 'src', 'width', 'height', 'frameborder', 'allowfullscreen' ],
            'a': [ 'href', 'target', 'rel', 'class', 'style' ],
            '*': [ 'style', 'class' ]
        }
    });
};

exports.getAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.findAll({
            include: [{ model: User, as: 'creator', attributes: ['id', 'username'] }],
            order: [['createdAt', 'DESC']]
        });
        res.render('admin/announcements', {
            title: 'Beheer Aankondigingen',
            announcements,
            user: req.user
        });
    } catch (error) {
        console.error('Error getting announcements:', error);
        res.redirect('/admin?error=Kon aankondigingen niet ophalen');
    }
};

exports.postAnnouncement = async (req, res) => {
    const { title, content, target, sendNotification } = req.body;
    try {
        if (!title || !content) {
            return res.redirect('/admin/announcements?error=Titel en inhoud zijn verplicht');
        }

        const cleanContent = sanitizeRichText(content);
        const shouldNotify = sendNotification === 'on' || sendNotification === true;

        const announcement = await Announcement.create({
            title,
            content: cleanContent,
            target: target || 'all',
            sendNotification: shouldNotify,
            isActive: true,
            creatorId: req.user.id
        });

        if (shouldNotify) {
            (async () => {
                const messageData = {
                    title: `📢 ${title}`,
                    body: cleanContent.replace(/<[^>]+>/g, '').substring(0, 100),
                    url: '/feed',
                    type: 'newPost'
                };

                let targetUsers;
                if (target === 'admin') {
                    targetUsers = await User.findAll({ where: { role: 'admin', isActive: true } });
                } else {
                    targetUsers = await User.findAll({ where: { isActive: true } });
                }

                await Promise.allSettled(
                    targetUsers.map(u => NotificationService.sendIndividualNotification(u, messageData))
                );
            })().catch(err => console.error('Error sending announcement notifications:', err));
        }

        res.redirect('/admin/announcements?success=Aankondiging succesvol aangemaakt');
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.redirect('/admin/announcements?error=Kon aankondiging niet aanmaken');
    }
};

exports.postToggleAnnouncement = async (req, res) => {
    const { id } = req.params;
    try {
        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            return res.redirect('/admin/announcements?error=Aankondiging niet gevonden');
        }

        announcement.isActive = !announcement.isActive;
        await announcement.save();

        res.redirect(`/admin/announcements?success=Status van '${announcement.title}' bijgewerkt`);
    } catch (error) {
        console.error('Error toggling announcement:', error);
        res.redirect('/admin/announcements?error=Kon status niet wijzigen');
    }
};

exports.deleteAnnouncement = async (req, res) => {
    const { id } = req.params;
    try {
        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            return res.redirect('/admin/announcements?error=Aankondiging niet gevonden');
        }

        await announcement.destroy();
        res.redirect('/admin/announcements?success=Aankondiging succesvol verwijderd');
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.redirect('/admin/announcements?error=Kon aankondiging niet verwijderen');
    }
};
