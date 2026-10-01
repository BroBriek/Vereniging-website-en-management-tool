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
 * Safe against multi-encoded JSON strings in SQLite.
 */
const normaliseTarget = (raw) => {
    if (!raw) return ['all'];
    let val = raw;
    while (typeof val === 'string') {
        try {
            val = JSON.parse(val);
        } catch (_) {
            break;
        }
    }
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return [val];
    return ['all'];
};

/**
 * Safely parse survey questions from raw or string.
 */
const normaliseQuestions = (raw, fallbackText, fallbackType) => {
    if (!raw) {
        if (fallbackText) {
            return [{ id: 0, text: fallbackText, type: fallbackType || 'score' }];
        }
        return [];
    }
    let val = raw;
    while (typeof val === 'string') {
        try {
            val = JSON.parse(val);
        } catch (_) {
            break;
        }
    }
    if (Array.isArray(val)) return val;
    if (fallbackText) {
        return [{ id: 0, text: fallbackText, type: fallbackType || 'score' }];
    }
    return [];
};

// ---------------------------------------------------------------------------
// Admin: list  (redirects to maintenance tab)
// ---------------------------------------------------------------------------

exports.getAnnouncements = (req, res) => {
    res.redirect('/admin/maintenance?tab=announcements');
};

// ---------------------------------------------------------------------------
// Admin: create or update (supports draft / concept saving)
// ---------------------------------------------------------------------------

exports.postAnnouncement = async (req, res) => {
    const redirect = (query) => res.redirect(`/admin/maintenance?tab=announcements&${query}`);

    try {
        const { id, title, content, sendNotification, hasSurvey, action } = req.body;

        if (!title || !title.trim()) {
            return redirect('error=Titel is verplicht');
        }
        if (!content || !content.trim()) {
            return redirect('error=Inhoud is verplicht');
        }

        const isDraft = action === 'draft' || req.body.isDraft === 'true' || req.body.isDraft === true;
        const cleanContent = sanitizeRichText(content);
        const shouldNotify = !isDraft && (sendNotification === 'on' || sendNotification === true || sendNotification === 'true');
        const surveyEnabled = hasSurvey === 'on' || hasSurvey === true || hasSurvey === 'true';

        // --- Target ---
        let rawTarget = req.body['target[]'] || req.body.target || ['all'];
        if (!Array.isArray(rawTarget)) rawTarget = [rawTarget];
        const validRoles = ['all', 'admin', 'leader', 'kookmoeke', 'media'];
        let targetArray = [...new Set(rawTarget.filter(r => validRoles.includes(r)))];
        if (targetArray.length === 0 || targetArray.includes('all')) targetArray = ['all'];

        // --- Survey questions ---
        let surveyQuestions = null;
        if (surveyEnabled && req.body.surveyQuestions) {
            const raw = req.body.surveyQuestions;
            const entries = Array.isArray(raw) ? raw : Object.values(raw);
            surveyQuestions = entries
                .filter(q => q && q.text && String(q.text).trim())
                .map((q, idx) => {
                    const rawType = q.type;
                    const type = (rawType === 'text' || rawType === 'multiple_choice' || rawType === 'multiple_choice_multi')
                        ? rawType
                        : 'score';
                    const qObj = {
                        id: idx,
                        text: String(q.text).trim(),
                        type
                    };
                    if (type === 'multiple_choice' || type === 'multiple_choice_multi') {
                        let opts = [];
                        if (q.options) {
                            const rawOpts = Array.isArray(q.options) ? q.options : Object.values(q.options);
                            opts = rawOpts.map(o => String(o).trim()).filter(Boolean);
                        }
                        if (opts.length === 0) {
                            opts = ['Optie 1', 'Optie 2'];
                        }
                        qObj.options = opts;
                    }
                    return qObj;
                });
            if (surveyQuestions.length === 0) surveyQuestions = null;
        }

        let announcement;
        let isUpdate = false;

        if (id) {
            announcement = await Announcement.findByPk(id);
            if (announcement) {
                isUpdate = true;
                announcement.title = title.trim();
                announcement.content = cleanContent;
                announcement.target = targetArray;
                announcement.sendNotification = sendNotification === 'on' || sendNotification === true || sendNotification === 'true';
                announcement.hasSurvey = surveyEnabled && surveyQuestions !== null;
                announcement.surveyQuestions = surveyQuestions;
                announcement.surveyQuestion = surveyQuestions && surveyQuestions.length > 0 ? surveyQuestions[0].text : null;
                announcement.surveyType = surveyQuestions && surveyQuestions.length > 0 ? surveyQuestions[0].type : null;
                announcement.isDraft = isDraft;
                if (!isDraft) {
                    announcement.isActive = true;
                }
                await announcement.save();
            }
        }

        if (!announcement) {
            announcement = await Announcement.create({
                title: title.trim(),
                content: cleanContent,
                target: targetArray,
                sendNotification: sendNotification === 'on' || sendNotification === true || sendNotification === 'true',
                isActive: !isDraft,
                isDraft,
                creatorId: req.user ? req.user.id : null,
                hasSurvey: surveyEnabled && surveyQuestions !== null,
                surveyQuestions,
                surveyQuestion: surveyQuestions && surveyQuestions.length > 0 ? surveyQuestions[0].text : null,
                surveyType: surveyQuestions && surveyQuestions.length > 0 ? surveyQuestions[0].type : null
            });
        }

        // --- Push notifications (fire & forget, only when published) ---
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
                    targetUsers.map(u => {
                        const userMsg = { ...msgData };
                        if (u.role === 'kookmoeke') {
                            userMsg.url = '/tetterhoekje';
                            userMsg.isTetterhoekje = true;
                        }
                        return NotificationService.sendIndividualNotification(u, userMsg);
                    })
                );
            })().catch(err => console.error('Announcement notification error:', err));
        }

        if (req.xhr || (req.headers && req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.json({ success: true, announcement, isDraft, isUpdate });
        }

        const msg = isDraft
            ? (isUpdate ? 'Concept succesvol bijgewerkt' : 'Concept succesvol opgeslagen')
            : (isUpdate ? 'Aankondiging succesvol bijgewerkt en gepubliceerd' : 'Aankondiging succesvol gepubliceerd');

        return redirect(`success=${encodeURIComponent(msg)}`);
    } catch (error) {
        console.error('Error saving announcement:', error);
        return redirect('error=Kon aankondiging niet opslaan');
    }
};

// ---------------------------------------------------------------------------
// Admin: publish concept (draft -> published)
// ---------------------------------------------------------------------------

exports.postPublishAnnouncement = async (req, res) => {
    const redirect = (query) => res.redirect(`/admin/maintenance?tab=announcements&${query}`);
    try {
        const announcement = await Announcement.findByPk(req.params.id);
        if (!announcement) return redirect('error=Aankondiging niet gevonden');

        announcement.isDraft = false;
        announcement.isActive = true;
        await announcement.save();

        if (announcement.sendNotification) {
            (async () => {
                const targetArray = normaliseTarget(announcement.target);
                const msgData = {
                    title: `📢 ${announcement.title}`,
                    body: announcement.content.replace(/<[^>]+>/g, '').substring(0, 100),
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
                    targetUsers.map(u => {
                        const userMsg = { ...msgData };
                        if (u.role === 'kookmoeke') {
                            userMsg.url = '/tetterhoekje';
                            userMsg.isTetterhoekje = true;
                        }
                        return NotificationService.sendIndividualNotification(u, userMsg);
                    })
                );
            })().catch(err => console.error('Announcement notification error:', err));
        }

        return redirect(`success=${encodeURIComponent(`Aankondiging '${announcement.title}' succesvol gepubliceerd!`)}`);
    } catch (error) {
        console.error('Error publishing announcement:', error);
        return redirect('error=Kon aankondiging niet publiceren');
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

        if (announcement.isDraft) {
            announcement.isDraft = false;
            announcement.isActive = true;
        } else {
            announcement.isActive = !announcement.isActive;
        }
        await announcement.save();

        return redirect(`success=${encodeURIComponent(`Status van '${announcement.title}' bijgewerkt`)}`);
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
// Admin: export announcement/poll as a JSON file
// ---------------------------------------------------------------------------

exports.exportAnnouncementFile = async (req, res) => {
    try {
        const announcement = await Announcement.findByPk(req.params.id);
        if (!announcement) return res.status(404).send('Aankondiging niet gevonden');

        const qs = normaliseQuestions(announcement.surveyQuestions, announcement.surveyQuestion, announcement.surveyType);

        const exportData = {
            $schema: 'chiro-announcement-v1',
            version: '1.0',
            exportedAt: new Date().toISOString(),
            data: {
                title: announcement.title,
                content: announcement.content,
                target: normaliseTarget(announcement.target),
                sendNotification: !!announcement.sendNotification,
                hasSurvey: !!announcement.hasSurvey,
                surveyQuestions: qs
            }
        };

        const slug = (announcement.title || 'aankondiging')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'aankondiging';

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${slug}-${announcement.id}.json"`);
        return res.send(JSON.stringify(exportData, null, 2));
    } catch (err) {
        console.error('Error exporting announcement file:', err);
        return res.status(500).send('Fout bij exporteren');
    }
};

// ---------------------------------------------------------------------------
// Admin: import announcement/poll from a JSON file (as a concept)
// ---------------------------------------------------------------------------

exports.importAnnouncementFile = async (req, res) => {
    const redirect = (query) => res.redirect(`/admin/maintenance?tab=announcements&${query}`);
    try {
        let payload = null;
        if (req.file && req.file.buffer) {
            try {
                payload = JSON.parse(req.file.buffer.toString('utf8'));
            } catch (e) {
                return redirect('error=Bestand bevat geen geldige JSON');
            }
        } else if (req.body && req.body.data) {
            payload = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
        } else if (req.body && req.body.title) {
            payload = req.body;
        }

        if (!payload) {
            return redirect('error=Geen bestand of gegevens ontvangen');
        }

        const data = payload.data || payload;
        const title = data.title ? String(data.title).trim() : '';
        const content = data.content ? sanitizeRichText(String(data.content)) : '';

        if (!title) {
            return redirect('error=Geïmporteerde aankondiging moet een titel hebben');
        }

        let targetArray = normaliseTarget(data.target);
        const validRoles = ['all', 'admin', 'leader', 'kookmoeke', 'media'];
        targetArray = [...new Set(targetArray.filter(r => validRoles.includes(r)))];
        if (targetArray.length === 0 || targetArray.includes('all')) targetArray = ['all'];

        let surveyQuestions = null;
        if (data.hasSurvey && data.surveyQuestions) {
            const raw = data.surveyQuestions;
            const entries = Array.isArray(raw) ? raw : Object.values(raw);
            surveyQuestions = entries
                .filter(q => q && q.text && String(q.text).trim())
                .map((q, idx) => {
                    const rawType = q.type;
                    const type = (rawType === 'text' || rawType === 'multiple_choice' || rawType === 'multiple_choice_multi')
                        ? rawType
                        : 'score';
                    const qObj = {
                        id: idx,
                        text: String(q.text).trim(),
                        type
                    };
                    if (type === 'multiple_choice' || type === 'multiple_choice_multi') {
                        let opts = [];
                        if (q.options) {
                            const rawOpts = Array.isArray(q.options) ? q.options : Object.values(q.options);
                            opts = rawOpts.map(o => String(o).trim()).filter(Boolean);
                        }
                        if (opts.length === 0) {
                            opts = ['Optie 1', 'Optie 2'];
                        }
                        qObj.options = opts;
                    }
                    return qObj;
                });
            if (surveyQuestions.length === 0) surveyQuestions = null;
        }

        const publishImmediately = req.body.publishImmediately === 'true' || req.body.publishImmediately === true;
        const isDraft = !publishImmediately;

        const announcement = await Announcement.create({
            title,
            content: content || '<p></p>',
            target: targetArray,
            sendNotification: !!data.sendNotification,
            isActive: publishImmediately,
            isDraft,
            creatorId: req.user ? req.user.id : null,
            hasSurvey: !!(data.hasSurvey && surveyQuestions),
            surveyQuestions,
            surveyQuestion: surveyQuestions && surveyQuestions.length > 0 ? surveyQuestions[0].text : null,
            surveyType: surveyQuestions && surveyQuestions.length > 0 ? surveyQuestions[0].type : null
        });

        if (req.xhr || (req.headers && req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.json({ success: true, announcement });
        }

        const msg = isDraft
            ? `Aankondiging '${title}' succesvol geïmporteerd als concept`
            : `Aankondiging '${title}' succesvol geïmporteerd en gepubliceerd`;

        return redirect(`success=${encodeURIComponent(msg)}`);
    } catch (err) {
        console.error('Error importing announcement:', err);
        return redirect('error=Fout bij importeren van bestand');
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

        const qs = normaliseQuestions(announcement.surveyQuestions, announcement.surveyQuestion, announcement.surveyType);

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Survey Resultaten');

        const typeLabels = {
            score: 'Score',
            text: 'Feedback',
            multiple_choice: 'Meerkeuze (1 antwoord)',
            multiple_choice_multi: 'Meerkeuze (meerdere antwoorden)'
        };

        ws.columns = [
            { header: 'Gebruiker', key: 'username', width: 25 },
            { header: 'Ingevuld op', key: 'createdAt', width: 20 },
            ...qs.map((q, idx) => ({
                header: `Vraag ${idx + 1}: ${q.text} (${typeLabels[q.type] || 'Score'})`,
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
            while (typeof userAns === 'string') {
                try { userAns = JSON.parse(userAns); } catch (_) { break; }
            }

            qs.forEach(q => {
                let val = '';
                const qKey = q.id !== undefined ? q.id : 0;
                if (userAns && (userAns[qKey] !== undefined || userAns[String(qKey)] !== undefined)) {
                    const a = userAns[qKey] !== undefined ? userAns[qKey] : userAns[String(qKey)];
                    if (a && typeof a === 'object') {
                        if (a.skipped) val = 'Overgeslagen';
                        else if (q.type === 'score') val = a.score !== undefined ? a.score : '';
                        else if (q.type === 'text') val = a.feedback || '';
                        else if (q.type === 'multiple_choice') val = a.selected !== undefined ? a.selected : '';
                        else if (q.type === 'multiple_choice_multi') {
                            val = Array.isArray(a.selected) ? a.selected.join(', ') : (a.selected || '');
                        } else {
                            val = a.selected || a.feedback || a.score || '';
                        }
                    } else if (a !== undefined) {
                        val = a;
                    }
                } else if ((qKey === 0 || qKey === '0') && !userAns) {
                    val = q.type === 'score' ? (r.score ?? '') : (r.feedback || '');
                }
                row[`q_${qKey}`] = val;
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
