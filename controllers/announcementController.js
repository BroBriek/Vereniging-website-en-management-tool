const { Announcement, User, SurveyResponse } = require('../models');
const { Op } = require('sequelize');
const NotificationService = require('../services/NotificationService');
const sanitizeHtml = require('sanitize-html');
const ExcelJS = require('exceljs');

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
    res.redirect('/admin/maintenance?tab=announcements');
};

exports.postAnnouncement = async (req, res) => {
    const { title, content, target, sendNotification, hasSurvey } = req.body;
    try {
        if (!title || !content) {
            return res.redirect('/admin/maintenance?tab=announcements&error=Titel en inhoud zijn verplicht');
        }

        const cleanContent = sanitizeRichText(content);
        const shouldNotify = sendNotification === 'on' || sendNotification === true;
        const surveyEnabled = hasSurvey === 'on' || hasSurvey === true;

        let formattedQuestions = null;
        if (surveyEnabled && req.body.surveyQuestions) {
            const rawQuestions = Array.isArray(req.body.surveyQuestions) 
                ? req.body.surveyQuestions 
                : (typeof req.body.surveyQuestions === 'object' && req.body.surveyQuestions !== null)
                    ? Object.values(req.body.surveyQuestions)
                    : [req.body.surveyQuestions];
            
            formattedQuestions = rawQuestions
                .filter(q => q && q.text && q.text.trim())
                .map((q, idx) => ({
                    id: idx,
                    text: q.text.trim(),
                    type: q.type || 'score'
                }));
        }

        const targetArray = Array.isArray(target) ? target : [target || 'all'];

        const announcement = await Announcement.create({
            title,
            content: cleanContent,
            target: targetArray,
            sendNotification: shouldNotify,
            isActive: true,
            creatorId: req.user.id,
            hasSurvey: surveyEnabled,
            surveyQuestions: formattedQuestions,
            // For backwards compatibility:
            surveyQuestion: formattedQuestions && formattedQuestions.length > 0 ? formattedQuestions[0].text : null,
            surveyType: formattedQuestions && formattedQuestions.length > 0 ? formattedQuestions[0].type : null
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
                if (targetArray.includes('all')) {
                    targetUsers = await User.findAll({ where: { isActive: true } });
                } else {
                    targetUsers = await User.findAll({ where: { role: { [Op.in]: targetArray }, isActive: true } });
                }

                await Promise.allSettled(
                    targetUsers.map(u => NotificationService.sendIndividualNotification(u, messageData))
                );
            })().catch(err => console.error('Error sending announcement notifications:', err));
        }

        res.redirect('/admin/maintenance?tab=announcements&success=Aankondiging succesvol aangemaakt');
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.redirect('/admin/maintenance?tab=announcements&error=Kon aankondiging niet aanmaken');
    }
};

exports.postToggleAnnouncement = async (req, res) => {
    const { id } = req.params;
    try {
        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            return res.redirect('/admin/maintenance?tab=announcements&error=Aankondiging niet gevonden');
        }

        announcement.isActive = !announcement.isActive;
        await announcement.save();

        res.redirect(`/admin/maintenance?tab=announcements&success=Status van '${announcement.title}' bijgewerkt`);
    } catch (error) {
        console.error('Error toggling announcement:', error);
        res.redirect('/admin/maintenance?tab=announcements&error=Kon status niet wijzigen');
    }
};

exports.deleteAnnouncement = async (req, res) => {
    const { id } = req.params;
    try {
        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            return res.redirect('/admin/maintenance?tab=announcements&error=Aankondiging niet gevonden');
        }

        await announcement.destroy();
        res.redirect('/admin/maintenance?tab=announcements&success=Aankondiging succesvol verwijderd');
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.redirect('/admin/maintenance?tab=announcements&error=Kon aankondiging niet verwijderen');
    }
};

exports.exportAnnouncementSurveyExcel = async (req, res) => {
    try {
        const { id } = req.params;
        const announcement = await Announcement.findByPk(id, {
            include: [
                { 
                    model: SurveyResponse, 
                    as: 'surveyResponses',
                    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
                }
            ]
        });

        if (!announcement) {
            return res.status(404).send('Aankondiging niet gevonden');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Survey Resultaten');

        // Determine questions
        let questions = announcement.surveyQuestions;
        if (questions && typeof questions === 'string') {
            try {
                questions = JSON.parse(questions);
            } catch (e) {}
        }
        if (!questions || !Array.isArray(questions)) {
            questions = [{ id: 0, text: announcement.surveyQuestion || 'Vraag', type: announcement.surveyType || 'score' }];
        }

        // Build columns
        const columns = [
            { header: 'Gebruiker', key: 'username', width: 25 },
            { header: 'Ingevuld op', key: 'createdAt', width: 20 }
        ];

        questions.forEach((q, idx) => {
            columns.push({ 
                header: `Vraag ${idx + 1}: ${q.text} (${q.type === 'score' ? 'Score' : 'Feedback'})`, 
                key: `q_${q.id}`, 
                width: 35 
            });
        });

        worksheet.columns = columns;

        // Add rows
        const responses = announcement.surveyResponses || [];
        responses.forEach(r => {
            const row = {
                username: r.user ? r.user.username : 'Onbekend',
                createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('nl-BE') : ''
            };

            let userAns = r.answers;
            if (userAns && typeof userAns === 'string') {
                try {
                    userAns = JSON.parse(userAns);
                } catch (e) {}
            }

            questions.forEach(q => {
                let answerVal = '';
                if (userAns && userAns[q.id] !== undefined) {
                    const ans = userAns[q.id];
                    if (ans.skipped) {
                        answerVal = 'Overgeslagen';
                    } else if (q.type === 'score') {
                        answerVal = ans.score;
                    } else {
                        answerVal = ans.feedback;
                    }
                } else if (q.id === 0 || q.id === '0') {
                    if (q.type === 'score') {
                        answerVal = r.score !== null ? r.score : '';
                    } else {
                        answerVal = r.feedback || '';
                    }
                }
                row[`q_${q.id}`] = answerVal;
            });

            worksheet.addRow(row);
        });

        // Style worksheet header row
        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=survey-results-${id}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting survey results:', error);
        res.status(500).send('Fout bij exporteren van survey resultaten');
    }
};
