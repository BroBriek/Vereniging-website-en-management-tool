const { Form, FormResponse, User } = require('../models');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const { sendMail } = require('../config/mailer');

exports.getForms = async (req, res) => {
    try {
        const forms = await Form.findAll({
            include: [{ model: User, as: 'creator', attributes: ['username'] }],
            order: [['createdAt', 'DESC']]
        });
        res.render('admin/forms/index', { title: 'Formulier Beheer', forms, user: req.user });
    } catch (error) {
        console.error('Error fetching forms:', error);
        res.redirect('/admin?error=Kon formulieren niet ophalen');
    }
};

exports.getCreateForm = (req, res) => {
    res.render('admin/forms/builder', { title: 'Nieuw Formulier', form: null, user: req.user });
};

exports.postCreateForm = async (req, res) => {
    try {
        const { title, description, status, fields, sendEmailOverview, emailFieldId, bannerEnabled } = req.body;
        
        // Generate slug from title
        let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        // Check if slug exists, if so append random string
        const exists = await Form.findOne({ where: { slug } });
        if (exists) {
            slug += '-' + Math.random().toString(36).substring(2, 7);
        }

        const parsedFields = typeof fields === 'string' ? JSON.parse(fields) : fields;

        await Form.create({
            title,
            description,
            slug,
            status,
            fields: parsedFields,
            sendEmailOverview: sendEmailOverview === 'true',
            emailFieldId: emailFieldId || null,
            bannerEnabled: bannerEnabled === 'true',
            bannerImage: req.file ? '/uploads/' + req.file.filename : null,
            creatorId: req.user.id
        });

        res.redirect('/admin/forms?success=Formulier aangemaakt');
    } catch (error) {
        console.error('Error creating form:', error);
        res.redirect('/admin/forms?error=Kon formulier niet aanmaken');
    }
};

exports.getEditForm = async (req, res) => {
    try {
        const form = await Form.findByPk(req.params.id);
        if (!form) return res.redirect('/admin/forms?error=Formulier niet gevonden');
        
        res.render('admin/forms/builder', { title: 'Bewerk Formulier', form, user: req.user });
    } catch (error) {
        console.error('Error fetching form for edit:', error);
        res.redirect('/admin/forms?error=Kon formulier niet laden');
    }
};

exports.postEditForm = async (req, res) => {
    try {
        const { title, description, status, fields, sendEmailOverview, emailFieldId, bannerEnabled } = req.body;
        const form = await Form.findByPk(req.params.id);
        if (!form) return res.redirect('/admin/forms?error=Formulier niet gevonden');

        const parsedFields = typeof fields === 'string' ? JSON.parse(fields) : fields;

        const updateData = {
            title,
            description,
            status,
            fields: parsedFields,
            sendEmailOverview: sendEmailOverview === 'true',
            emailFieldId: emailFieldId || null,
            bannerEnabled: bannerEnabled === 'true'
        };

        if (req.file) {
            updateData.bannerImage = '/uploads/' + req.file.filename;
        }

        await form.update(updateData);

        res.redirect('/admin/forms?success=Formulier bijgewerkt');
    } catch (error) {
        console.error('Error updating form:', error);
        res.redirect('/admin/forms?error=Kon formulier niet bijwerken');
    }
};

exports.postDeleteForm = async (req, res) => {
    try {
        const form = await Form.findByPk(req.params.id);
        if (form) {
            await form.destroy();
        }
        res.redirect('/admin/forms?success=Formulier verwijderd');
    } catch (error) {
        console.error('Error deleting form:', error);
        res.redirect('/admin/forms?error=Kon formulier niet verwijderen');
    }
};

exports.getResponses = async (req, res) => {
    try {
        const form = await Form.findByPk(req.params.id, {
            include: [{ model: FormResponse, as: 'responses' }]
        });
        if (!form) return res.redirect('/admin/forms?error=Formulier niet gevonden');

        // Order responses by submittedAt DESC manually if needed, or rely on association order
        const responses = form.responses.sort((a, b) => b.submittedAt - a.submittedAt);

        res.render('admin/forms/responses', { title: `Antwoorden: ${form.title}`, form, responses, user: req.user });
    } catch (error) {
        console.error('Error fetching responses:', error);
        res.redirect('/admin/forms?error=Kon antwoorden niet ophalen');
    }
};

exports.updateResponse = async (req, res) => {
    try {
        const { fieldId, value } = req.body;
        const response = await FormResponse.findByPk(req.params.id);
        if (!response) return res.status(404).json({ success: false, error: 'Antwoord niet gevonden' });

        if (fieldId === 'nickname') {
            await response.update({ nickname: value });
        } else {
            const newData = { ...response.data };
            newData[fieldId] = value;
            await response.update({ data: newData });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating response:', error);
        res.status(500).json({ success: false, error: 'Server fout' });
    }
};

exports.deleteResponse = async (req, res) => {
    try {
        const response = await FormResponse.findByPk(req.params.id);
        if (response) {
            await response.destroy();
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting response:', error);
        res.status(500).json({ success: false, error: 'Server fout' });
    }
};

exports.resetForm = async (req, res) => {
    try {
        const formId = req.params.id;
        const form = await Form.findByPk(formId);
        if (!form) {
            if (req.xhr || req.headers.accept?.includes('json')) {
                return res.status(404).json({ success: false, error: 'Formulier niet gevonden' });
            }
            return res.redirect('/admin/forms?error=Formulier niet gevonden');
        }

        await FormResponse.destroy({ where: { formId } });

        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.json({ success: true, message: 'Alle antwoorden zijn verwijderd' });
        }
        res.redirect(`/admin/forms/${formId}/responses?success=Alle antwoorden zijn verwijderd`);
    } catch (error) {
        console.error('Error resetting form responses:', error);
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(500).json({ success: false, error: 'Server fout bij herstellen van formulier' });
        }
        res.redirect(`/admin/forms/${req.params.id}/responses?error=Kon antwoorden niet verwijderen`);
    }
};

exports.exportResponses = async (req, res) => {
    try {
        const form = await Form.findByPk(req.params.id, {
            include: [{ model: FormResponse, as: 'responses' }]
        });
        if (!form) return res.status(404).send('Formulier niet gevonden');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Antwoorden');

        // Define columns based on form fields
        const columns = [
            { header: 'Datum', key: 'submittedAt', width: 20 },
            { header: 'Bijnaam', key: 'nickname', width: 20 }
        ];

        // Only include questions in columns
        const questionFields = form.fields.filter(f => ['short_text', 'long_text', 'multiple_choice', 'multiple_choice_multi', 'pricing'].includes(f.type));
        
        questionFields.forEach(f => {
            if (f.type === 'pricing') {
                (f.options || []).forEach(opt => {
                    columns.push({ header: `${f.label}: ${opt.label}`, key: `${f.id}_${opt.label}`, width: 20 });
                });
                columns.push({ header: `${f.label}: Totaal`, key: `${f.id}_total`, width: 15 });
            } else {
                columns.push({ header: f.label, key: f.id, width: 30 });
            }
        });

        worksheet.columns = columns;

        form.responses.forEach(resp => {
            const row = {
                submittedAt: resp.submittedAt.toLocaleString('nl-BE'),
                nickname: resp.nickname || ''
            };
            
            questionFields.forEach(f => {
                let answer = resp.data[f.id];
                if (f.type === 'pricing') {
                    (f.options || []).forEach(opt => {
                        row[`${f.id}_${opt.label}`] = (answer && answer[opt.label]) ? parseInt(answer[opt.label]) : 0;
                    });
                    row[`${f.id}_total`] = (answer && answer.total) ? parseFloat(answer.total) : 0;
                } else {
                    if (Array.isArray(answer)) {
                        answer = answer.join(', ');
                    }
                    row[f.id] = answer;
                }
            });

            worksheet.addRow(row);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=responses-${form.slug}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting responses:', error);
        res.status(500).send('Fout bij exporteren');
    }
};

exports.exportEetdagPDF = async (req, res) => {
    try {
        const { nameField, orderFields, tableField, blankTickets, useNicknames, sortBy } = req.query;
        const form = await Form.findByPk(req.params.id, {
            include: [{ model: FormResponse, as: 'responses' }]
        });
        if (!form) return res.status(404).send('Formulier niet gevonden');

        const doc = new PDFDocument({ size: 'A4', margin: 20 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=eetdag-${form.slug}.pdf`);
        doc.pipe(res);

        const cols = 3;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 20;
        const slipWidth = (pageWidth - (margin * 2)) / cols;
        const pageBottom = pageHeight - margin;

        let responses = [...form.responses];

        // Sort responses
        if (sortBy === 'newest') {
            responses.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        } else if (sortBy === 'oldest') {
            responses.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
        } else {
            // Default: alphabetical
            responses.sort((a, b) => {
                const getName = (r) => {
                    if (useNicknames === 'true' && r.nickname) return r.nickname;
                    return r.data[nameField] || '';
                };
                return getName(a).localeCompare(getName(b), 'nl-BE', { sensitivity: 'base' });
            });
        }

        const selectedOrderFields = Array.isArray(orderFields) ? orderFields : (orderFields ? [orderFields] : []);

        // Add blank tickets to the list
        const numBlank = parseInt(blankTickets) || 0;
        const itemsToPrint = [...responses.map(r => ({ 
            data: r.data, 
            nickname: r.nickname,
            isBlank: false 
        }))];
        for (let i = 0; i < numBlank; i++) {
            itemsToPrint.push({ data: {}, isBlank: true });
        }

        // Helper to get items for a response or blank ticket
        const getOrderItems = (itemObj) => {
            const items = [];
            selectedOrderFields.forEach(fieldId => {
                const field = form.fields.find(f => f.id === fieldId);
                if (!field) return;

                if (itemObj.isBlank) {
                    if (field.type === 'pricing' && field.options && field.options.items) {
                        field.options.items.forEach(i => items.push(i.name));
                    } else if (field.type === 'multiple_choice' || field.type === 'multiple_choice_multi') {
                        items.push(field.label);
                    }
                    return;
                }

                const answer = itemObj.data[fieldId];
                if (!answer) return;

                if (field.type === 'pricing') {
                    Object.entries(answer).forEach(([item, qty]) => {
                        if (item !== 'total' && parseInt(qty) > 0) items.push(`${qty} ${item}`);
                    });
                } else if (field.type === 'multiple_choice_multi' && Array.isArray(answer)) {
                    answer.forEach(item => items.push(`1 ${item}`));
                } else if (field.type === 'multiple_choice') {
                    items.push(`1 ${answer}`);
                }
            });
            return items;
        };

        // Helper to calculate height needed for a slip
        const calculateSlipHeight = (items) => {
            const headerHeight = 55; // NAAM, TAFEL + gaps
            const itemHeight = 13;
            const padding = 20;
            return Math.max(90, headerHeight + (items.length * itemHeight) + padding);
        };

        let currentY = margin;
        
        // Process in rows of 3
        for (let i = 0; i < itemsToPrint.length; i += cols) {
            const rowItems = itemsToPrint.slice(i, i + cols);
            const rowOrderItems = rowItems.map(item => getOrderItems(item));
            const rowHeights = rowOrderItems.map(items => calculateSlipHeight(items));
            const maxHeight = Math.max(...rowHeights);

            // Check if row fits on current page
            if (currentY + maxHeight > pageBottom) {
                doc.addPage();
                currentY = margin;
            }

            // Draw the slips in this row
            rowItems.forEach((itemObj, colIndex) => {
                const startX = margin + colIndex * slipWidth;
                const items = rowOrderItems[colIndex];
                
                // Draw dotted border
                doc.rect(startX, currentY, slipWidth, maxHeight).dash(3, { space: 3 }).stroke('#ccc').undash();

                const x = startX + 15;
                const y = currentY + 15;

                // Header
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#000');
                doc.text('NAAM:', x, y);
                doc.text('TAFEL:', x, y + 16);

                if (!itemObj.isBlank) {
                    let name = itemObj.data[nameField] || '';
                    if (useNicknames === 'true' && itemObj.nickname) {
                        name = itemObj.nickname;
                    }
                    doc.fontSize(11).font('Helvetica').text(name, x + 45, y, { width: slipWidth - 65, height: 16, ellipsis: true });
                    
                    if (tableField) {
                        const table = itemObj.data[tableField] || '';
                        doc.fontSize(11).font('Helvetica').text(table, x + 45, y + 16, { width: slipWidth - 65, height: 16, ellipsis: true });
                    }
                }

                // Items
                let itemY = y + 42;
                doc.fontSize(10).font('Helvetica-Bold');
                items.forEach(item => {
                    doc.text(item, x + 15, itemY, { width: slipWidth - 30 });
                    itemY += 13;
                });
            });

            currentY += maxHeight;
        }

        doc.end();
    } catch (error) {
        console.error('Error exporting eetdag PDF:', error);
        res.status(500).send('Fout bij exporteren');
    }
};

// Public Methods
exports.getPublicForm = async (req, res) => {
    try {
        const form = await Form.findOne({ where: { slug: req.params.slug } });
        if (!form) return res.status(404).render('error', { status: 404, description: 'Formulier niet gevonden', user: req.user || null });
        
        const isAdmin = req.user && req.user.role === 'admin';
        
        if (form.status === 'invisible' && !isAdmin) {
            return res.status(403).render('error', { status: 403, description: 'Dit formulier is nog niet openbaar.', user: req.user || null });
        }

        res.render('public/form', { title: form.title, form, user: req.user || null, isAdmin });
    } catch (error) {
        console.error('Error fetching public form:', error);
        res.status(500).send('Server Error');
    }
};

exports.postSubmitForm = async (req, res) => {
    try {
        const form = await Form.findOne({ where: { slug: req.params.slug } });
        if (!form) return res.status(404).send('Formulier niet gevonden');
        
        const isAdmin = req.user && req.user.role === 'admin';
        
        if (form.status !== 'visible' && !isAdmin) {
            return res.status(403).send('Dit formulier accepteert geen antwoorden meer.');
        }

        // Validate and extract answers
        const answers = {};
        form.fields.forEach(f => {
            if (['short_text', 'long_text', 'multiple_choice', 'multiple_choice_multi', 'pricing'].includes(f.type)) {
                answers[f.id] = req.body[f.id];
            }
        });

        await FormResponse.create({
            formId: form.id,
            data: answers
        });

        // Send email overview if enabled
        if (form.sendEmailOverview && form.emailFieldId && answers[form.emailFieldId]) {
            const recipientEmail = answers[form.emailFieldId];
            
            // Simple email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(recipientEmail)) {
                // Build summary HTML
                let summaryTableRows = '';
                form.fields.forEach(f => {
                    if (['short_text', 'long_text', 'multiple_choice', 'multiple_choice_multi', 'pricing'].includes(f.type)) {
                        const answer = answers[f.id];
                        let displayAnswer = answer || '-';

                        if (f.type === 'pricing') {
                            if (answer && typeof answer === 'object') {
                                displayAnswer = '<ul style="padding-left: 20px; margin: 0; list-style-type: none;">';
                                for (const [key, val] of Object.entries(answer)) {
                                    if (key !== 'total' && parseInt(val) > 0) {
                                        displayAnswer += `<li>- ${key}: <strong>${val}x</strong></li>`;
                                    }
                                }
                                displayAnswer += `<li style="margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 5px;">Totaal: <strong>€${answer.total || 0}</strong></li>`;
                                displayAnswer += '</ul>';
                            }
                        } else if (Array.isArray(answer)) {
                            displayAnswer = answer.join(', ');
                        }

                        summaryTableRows += `
                            <tr>
                                <td style="padding: 12px 10px; border-bottom: 1px solid #f0f0f0; font-weight: bold; width: 40%; vertical-align: top; color: #555; font-size: 14px;">${f.label}</td>
                                <td style="padding: 12px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; color: #333; font-size: 14px;">${displayAnswer}</td>
                            </tr>
                        `;
                    }
                });

                const summaryHtml = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="background-color: #db3e41; padding: 30px 20px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Overzicht van je inschrijving</h1>
                        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">${form.title}</p>
                    </div>
                    <div style="padding: 30px 25px; background-color: #ffffff;">
                        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Beste,</p>
                        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">Bedankt voor je invulling. Hieronder vind je een overzicht van je antwoorden voor <strong>${form.title}</strong>:</p>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            ${summaryTableRows}
                        </table>
                        
                        <div style="margin-top: 35px; padding-top: 20px; border-top: 2px solid #f8f9fa;">
                            <p style="margin: 0; font-size: 16px; color: #555;">Met vriendelijke groeten,</p>
                            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #db3e41;">Chiro</p>
                        </div>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #888; border-top: 1px solid #eeeeee;">
                        Dit is een automatisch verzonden bericht van de Chiro website. Je kunt niet antwoorden op deze e-mail.
                    </div>
                </div>
            `;

            try {
                await sendMail({
                    to: recipientEmail,
                    subject: `Overzicht: ${form.title}`,
                    html: summaryHtml
                });
            } catch (mailError) {
                console.error('Error sending form overview email:', mailError);
            }
        }
    }

    res.render('public/form_success', { title: 'Bedankt!', form, user: req.user || null });
    } catch (error) {
        console.error('Error submitting form:', error);
        res.status(500).send('Fout bij verzenden van formulier');
    }
};
