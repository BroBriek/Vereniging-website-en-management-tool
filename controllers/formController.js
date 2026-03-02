const { Form, FormResponse, User } = require('../models');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');

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
        const { title, description, status, fields } = req.body;
        
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
        const { title, description, status, fields } = req.body;
        const form = await Form.findByPk(req.params.id);
        if (!form) return res.redirect('/admin/forms?error=Formulier niet gevonden');

        const parsedFields = typeof fields === 'string' ? JSON.parse(fields) : fields;

        await form.update({
            title,
            description,
            status,
            fields: parsedFields
        });

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

        const newData = { ...response.data };
        newData[fieldId] = value;
        
        await response.update({ data: newData });
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
            { header: 'Datum', key: 'submittedAt', width: 20 }
        ];

        // Only include questions in columns
        const questionFields = form.fields.filter(f => ['short_text', 'long_text', 'multiple_choice', 'multiple_choice_multi'].includes(f.type));
        
        questionFields.forEach(f => {
            columns.push({ header: f.label, key: f.id, width: 30 });
        });

        worksheet.columns = columns;

        form.responses.forEach(resp => {
            const row = {
                submittedAt: resp.submittedAt.toLocaleString('nl-BE')
            };
            
            questionFields.forEach(f => {
                let answer = resp.data[f.id];
                if (Array.isArray(answer)) {
                    answer = answer.join(', ');
                }
                row[f.id] = answer;
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
            if (['short_text', 'long_text', 'multiple_choice', 'multiple_choice_multi'].includes(f.type)) {
                answers[f.id] = req.body[f.id];
            }
        });

        await FormResponse.create({
            formId: form.id,
            data: answers
        });

        res.render('public/form_success', { title: 'Bedankt!', form, user: req.user || null });
    } catch (error) {
        console.error('Error submitting form:', error);
        res.status(500).send('Fout bij verzenden van formulier');
    }
};
