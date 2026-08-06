const { Announcement, User, SurveyResponse } = require('../models');
const { Op } = require('sequelize');
const NotificationService = require('../services/NotificationService');
const sanitizeHtml = require('sanitize-html');
const ExcelJS = require('exceljs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sanitizeRichText = (html) => {
    if (!html) return '';
    return sanitizeHtml(html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'iframe']),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'width', 'height', 'style', 'class'],
            iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
            a: ['href', 'target', 'rel', 'class', 'style'],
            '*': ['style', 'class']
        }
    });
};

/**
 * Normalise the target value stored in the DB to a plain JS array.
 * The target column is DataTypes.JSON but SQLite double-encodes it, so
 * calling the model's getter is the safest approach.
 */
const normaliseTarget = (raw) => {
    if (!raw) return ['all'];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (_) {
            return [raw];
        }
    }
    return ['all'];
};

// ---------------------------------------------------------------------------
// Admin: list  (redirects to maintenance tab)
// ---------------------------------------------------------------------------

exports.getAnnouncements = (req, res) => {
    res.redirect('/admin/maintenance?tab=announcements');
};

// ---------------------------------------------------------------------------
// Admin: create
// ---------------------------------------------------------------------------

exports.postAnnouncement = async (req, res) => {
    const redirect = (query) => res.redirect(`/admin/maintenance?tab=announcements&${query}`);

    try {
        const { title, content, sendNotification, hasSurvey } = req.body;

        if (!title || !title.trim()) {
            return redirect('error=Titel is verplicht');
        }
        if (!content || !content.trim()) {
            return redirect('error=Inhoud is verplicht');
        }

        const cleanContent = sanitizeRichText(content);
        const shouldNotify = sendNotification === 'on' || sendNotification === true;
        const surveyEnabled = hasSurvey === 'on' || hasSurvey === true;

        // --- Target ---
        // The checkbox group sends target[] as an array (or single string)
        let rawTarget = req.body['target[]'] || req.body.target || ['all'];
        if (!Array.isArray(rawTarget)) rawTarget = [rawTarget];
        // Remove duplicates, ensure valid values only
        const validRoles = ['all', 'admin', 'leader', 'kookmoeke', 'media'];
        let targetArray = [...new Set(rawTarget.filter(r => validRoles.includes(r)))];
        if (targetArray.length === 0) targetArray = ['all'];
        // If 'all' is selected, ignore the others
        if (targetArray.includes('all')) targetArray = ['all'];

        // --- Survey questions ---
        let surveyQuestions = null;
        if (surveyEnabled && req.body.surveyQuestions) {
            const raw = req.body.surveyQuestions;
            // qs may arrive as an object keyed by index {0:{text,type}, 1:{text,type}}
            // or as an array if express parses it that way
            const entries = Array.isArray(raw) ? raw : Object.values(raw);
            surveyQuestions = entries
                .filter(q => q && q.text && q.text.trim())
                .map((q, idx) => ({
                    id: idx,
                    text: q.text.trim(),
                    type: q.type === 'text' ? 'text' : 'score'
                }));
            if (surveyQuestions.length === 0) surveyQuestions = null;
        }

        const announcement = await Announcement.create({
            title: title.trim(),
            content: cleanContent,
            target: targetArray,
            sendNotification: shouldNotify,
            isActive: true,
            creatorId: req.user.id,
            hasSurvey: surveyEnabled && surveyQuestions !== null,
            surveyQuestions,
            // Legacy backwards-compat fields
            surveyQuestion: surveyQuestions && surveyQuestions.length > 0 ? surveyQuestions[0].text : null,
            surveyType: surveyQuestions && surveyQuestions.length > 0 ? surveyQuestions[0].type : null
        });

        // --- Push notifications (fire & forget) ---
        if (shouldNotify) {
            (async () => {
                const msgData = {
                    title: `📢 ${title.trim()}`,
                    body: cleanContent.replace(/<[^>]+>/g, '').substring(0, 100),
                    url: '/feed',
                    type: 'newPost'
                };

                let targetUsers;
                if (targetArray.includes('all')) {
                    targetUsers = await User.findAll({ where: { isActive: true } });
                } else {
                    targetUsers = await User.findAll({
                        where: { role: { [Op.in]: targetArray }, isActive: true }
                    });
                }

                await Promise.allSettled(
                    targetUsers.map(u => NotificationService.sendIndividualNotification(u, msgData))
                );
            })().catch(err => console.error('Announcement notification error:', err));
        }

        return redirect('success=Aankondiging succesvol aangemaakt');
    } catch (error) {
        console.error('Error creating announcement:', error);
        return redirect('error=Kon aankondiging niet aanmaken');
    }
};

// ---------------------------------------------------------------------------
// Admin: toggle active/inactive
// ---------------------------------------------------------------------------

exports.postToggleAnnouncement = async (req, res) => {
    const redirect = (query) => res.redirect(`/admin/maintenance?tab=announcements&${query}`);
    try {
        const announcement = await Announcement.findByPk(req.params.id);
        if (!announcement) return redirect('error=Aankondiging niet gevonden');

        announcement.isActive = !announcement.isActive;
        await announcement.save();

        return redirect(`success=Status van '${announcement.title}' bijgewerkt`);
    } catch (error) {
        console.error('Error toggling announcement:', error);
        return redirect('error=Kon status niet wijzigen');
    }
};

// ---------------------------------------------------------------------------
// Admin: delete
// ---------------------------------------------------------------------------

exports.deleteAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement.findByPk(req.params.id);
        if (!announcement) return res.status(404).json({ success: false, error: 'Aankondiging niet gevonden' });

        await announcement.destroy();
        return res.json({ success: true });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        return res.status(500).json({ success: false, error: 'Kon aankondiging niet verwijderen' });
    }
};

// ---------------------------------------------------------------------------
// Admin: export survey results to Excel
// ---------------------------------------------------------------------------

exports.exportAnnouncementSurveyExcel = async (req, res) => {
    try {
        const announcement = await Announcement.findByPk(req.params.id, {
            include: [{
                model: SurveyResponse,
                as: 'surveyResponses',
                include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
            }]
        });

        if (!announcement) return res.status(404).send('Aankondiging niet gevonden');

        let questions = normaliseTarget(announcement.surveyQuestions);
        // surveyQuestions is a different field — parse it directly
        let qs = announcement.surveyQuestions;
        if (!Array.isArray(qs)) {
            qs = [{ id: 0, text: announcement.surveyQuestion || 'Vraag', type: announcement.surveyType || 'score' }];
        }

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Survey Resultaten');

        ws.columns = [
            { header: 'Gebruiker', key: 'username', width: 25 },
            { header: 'Ingevuld op', key: 'createdAt', width: 20 },
            ...qs.map((q, idx) => ({
                header: `Vraag ${idx + 1}: ${q.text} (${q.type === 'score' ? 'Score' : 'Feedback'})`,
                key: `q_${q.id}`,
                width: 35
            }))
        ];

        const responses = announcement.surveyResponses || [];
        responses.forEach(r => {
            const row = {
                username: r.user ? r.user.username : 'Onbekend',
                createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('nl-BE') : ''
            };

            let userAns = r.answers;
            if (typeof userAns === 'string') {
                try { userAns = JSON.parse(userAns); } catch (_) { userAns = null; }
            }

            qs.forEach(q => {
                let val = '';
                if (userAns && userAns[q.id] !== undefined) {
                    const a = userAns[q.id];
                    if (a.skipped) val = 'Overgeslagen';
                    else if (q.type === 'score') val = a.score;
                    else val = a.feedback;
                } else if ((q.id === 0 || q.id === '0') && !userAns) {
                    val = q.type === 'score' ? (r.score ?? '') : (r.feedback || '');
                }
                row[`q_${q.id}`] = val;
            });

            ws.addRow(row);
        });

        ws.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=survey-${req.params.id}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting survey:', error);
        res.status(500).send('Fout bij exporteren');
    }
};
