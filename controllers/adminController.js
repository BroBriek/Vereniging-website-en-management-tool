const { PageContent, Leader, Event, Registration, User, Post, Comment, PostResponse, FeedGroup, UserGroupAccess, sequelize } = require('../models');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const NotificationService = require('../services/NotificationService');
const PeriodService = require('../services/PeriodService');
const { sendMail } = require('../config/mailer');

exports.getDashboard = (req, res) => {
    res.render('admin/dashboard', { title: 'Admin Dashboard', user: req.user });
};

exports.getEditPage = async (req, res) => {
    const slug = req.params.page;
    const contents = await PageContent.findAll({ where: { slug } });
    const contentMap = {};
    contents.forEach(c => contentMap[c.section_key] = c);
    
    res.render('admin/edit_page', { title: `Bewerk ${slug}`, slug, contentMap, user: req.user });
};

exports.postEditPage = async (req, res) => {
    const slug = req.params.page;
    
    // Handle text fields
    for (const key in req.body) {
        if (key === 'image_key') continue; 
        await PageContent.upsert({
            slug,
            section_key: key,
            content: req.body[key]
        });
    }

    // Handle Image Upload
    if (req.file) {
        const imageKey = req.body.image_key || 'hero_image';
        await PageContent.upsert({
            slug,
            section_key: imageKey,
            content: `/uploads/${req.file.filename}`
        });
    }
    
    res.redirect(`/admin/page/${slug}?success=${encodeURIComponent('Pagina succesvol bijgewerkt!')}`);
};

exports.getLeaders = async (req, res) => {
    const leaders = await Leader.findAll({ order: [['group', 'ASC']] });
    res.render('admin/leaders', { title: 'Beheer Leiding', leaders, user: req.user });
};

exports.postLeader = async (req, res) => {
    try {
        const { name, group, years_active, study, extra_info, birth_date } = req.body;
        const is_head_leader = req.body.is_head_leader === 'on';
        const image = req.file ? `/uploads/${req.file.filename}` : null;
        await Leader.create({ name, group, years_active, study, extra_info, image, birth_date, is_head_leader });
        res.redirect('/admin/leaders');
    } catch (error) {
        console.error('Error creating leader:', error);
        res.redirect('/admin/leaders?error=Kon leiding niet aanmaken');
    }
};

exports.getEditLeader = async (req, res) => {
    const leader = await Leader.findByPk(req.params.id);
    if (!leader) {
        return res.redirect('/admin/leaders');
    }
    res.render('admin/edit_leader', { title: 'Bewerk Leiding', leader, user: req.user });
};

exports.updateLeader = async (req, res) => {
    try {
        const { name, group, years_active, study, extra_info, birth_date } = req.body;
        const is_head_leader = req.body.is_head_leader === 'on';
        const leader = await Leader.findByPk(req.params.id);
        if (leader) {
            let image = leader.image;
            if (req.file) {
                image = `/uploads/${req.file.filename}`;
            }
            await leader.update({ name, group, years_active, study, extra_info, image, birth_date, is_head_leader });
        }
        res.redirect('/admin/leaders');
    } catch (error) {
        console.error('Error updating leader:', error);
        res.redirect('/admin/leaders?error=Kon leiding niet bijwerken');
    }
};

exports.deleteLeader = async (req, res) => {
    try {
        await Leader.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/leaders');
    } catch (error) {
        console.error('Error deleting leader:', error);
        res.redirect('/admin/leaders?error=Kon leiding niet verwijderen');
    }
};

exports.getEvents = async (req, res) => {
    const events = await Event.findAll({ order: [['date', 'DESC']] });
    res.render('admin/events', { title: 'Beheer Kalender', events, user: req.user });
};

exports.postEvent = async (req, res) => {
    try {
        const { title, date, description } = req.body;
        await Event.create({ title, date, description });
        res.redirect('/admin/events');
    } catch (error) {
        console.error('Error creating event:', error);
        res.redirect('/admin/events?error=Kon evenement niet aanmaken');
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        await Event.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/events');
    } catch (error) {
        console.error('Error deleting event:', error);
        res.redirect('/admin/events?error=Kon evenement niet verwijderen');
    }
};

exports.getInfo = (req, res) => {
    res.render('admin/info', { title: 'Handleiding', user: req.user });
};

exports.getRegistrations = async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const currentPeriod = await PeriodService.getCurrentPeriod();
        
        // 1. Get all unique periods from DB
        const periodsData = await Registration.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('period')), 'period']],
            order: [['period', 'DESC']],
            raw: true
        });
        const allPeriods = periodsData.map(p => p.period).filter(p => p); // Remove nulls if any
        
        // Ensure current period is in the list even if no registrations yet
        if (!allPeriods.includes(currentPeriod)) {
            allPeriods.unshift(currentPeriod);
        }

        // 2. Determine filter settings
        const selectedPeriod = req.query.period || currentPeriod;
        const searchQuery = (req.query.search || '').trim();
        
        const where = {};

        // Filter by Period (unless 'all' is selected)
        if (selectedPeriod !== 'all') {
            where.period = selectedPeriod;
        }

        // Filter by Search
        if (searchQuery) {
            where[Op.or] = [
                { firstName: { [Op.like]: `%${searchQuery}%` } },
                { lastName: { [Op.like]: `%${searchQuery}%` } },
                { email: { [Op.like]: `%${searchQuery}%` } },
                { parentsNames: { [Op.like]: `%${searchQuery}%` } }
            ];
        }

        const registrations = await Registration.findAll({
            where,
            order: [
                ['group', 'ASC'],
                ['type', 'DESC'], 
                ['lastName', 'ASC']
            ]
        });

        res.render('admin/registrations', { 
            title: 'Inschrijvingen', 
            registrations, 
            user: req.user, 
            currentPeriod, // The system's active period
            selectedPeriod, // The period being viewed
            allPeriods,
            searchQuery
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.redirect('/admin?error=Kon inschrijvingen niet ophalen');
    }
};

exports.deleteRegistration = async (req, res) => {
    try {
        await Registration.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/registrations?success=Inschrijving verwijderd.');
    } catch (error) {
        console.error('Error deleting registration:', error);
        res.redirect('/admin/registrations?error=Kon inschrijving niet verwijderen.');
    }
};

exports.exportRegistrationsExcel = async (req, res) => {
    const mode = req.query.mode || 'current'; // 'current' or 'all'
    let where = {};
    let filename = 'inschrijvingen.xlsx';

    if (mode === 'current') {
        const currentPeriod = await PeriodService.getCurrentPeriod();
        where.period = currentPeriod;
        filename = `inschrijvingen-${currentPeriod}.xlsx`;
    } else {
        // For 'all' mode, no 'where' clause is added for period, effectively getting all
        filename = 'inschrijvingen-alles.xlsx';
    }

    const registrations = await Registration.findAll({
        where: where, // Apply the filter for the period
        order: [
            ['group', 'ASC'],
            ['type', 'ASC'],
            ['lastName', 'ASC']
        ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inschrijvingen');

    // Define columns
    worksheet.columns = [
        { header: 'Groep', key: 'group', width: 15 },
        { header: 'Rol', key: 'type', width: 10 },
        { header: 'Voornaam', key: 'firstName', width: 20 },
        { header: 'Achternaam', key: 'lastName', width: 20 },
        { header: 'Geboortedatum', key: 'birthdate', width: 15 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Telefoon (Ouders/Leiding)', key: 'primaryPhone', width: 20 },
        { header: 'GSM Lid (Optioneel)', key: 'memberPhone', width: 20 },
        { header: 'Namen Ouders/Voogd', key: 'parentsNames', width: 30 },
        { header: 'Foto Toestemming', key: 'photoPermission', width: 20 },
        { header: 'Medische Info', key: 'medicalInfo', width: 40 }
    ];

    // Add rows
    registrations.forEach(reg => {
        worksheet.addRow({
            group: reg.group,
            type: reg.type,
            firstName: reg.firstName,
            lastName: reg.lastName,
            birthdate: reg.birthdate,
            email: reg.email,
            primaryPhone: reg.type === 'lid' ? reg.parentsPhone : reg.phone,
            memberPhone: reg.memberPhone,
            parentsNames: reg.parentsNames,
            photoPermission: reg.photoPermission ? 'Ja' : 'Nee',
            medicalInfo: reg.medicalInfo
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'inschrijvingen.xlsx');

    await workbook.xlsx.write(res);
    res.end();
};

exports.startNewPeriod = async (req, res) => {
    try {
        const newPeriod = await PeriodService.startNewPeriod();
        res.redirect('/admin/registrations?success=' + encodeURIComponent(`Nieuwe periode gestart: ${newPeriod}`));
    } catch (error) {
        console.error('Error starting new period:', error);
        res.redirect('/admin/registrations?error=Kon nieuwe periode niet starten');
    }
};

exports.exportRegistrationsPDF = async (req, res) => {
    try {
        const mode = req.query.mode || 'current'; // 'current' or 'all'
        let where = {};
        let filename = 'ledenlijst.pdf';
        
        if (mode === 'current') {
            const currentPeriod = await PeriodService.getCurrentPeriod();
            where.period = currentPeriod;
            filename = `ledenlijst-${currentPeriod}.pdf`;
        } else {
            filename = 'ledenlijst-alles.pdf';
        }

        const registrations = await Registration.findAll({
            where,
            order: [['period', 'DESC'], ['group', 'ASC'], ['lastName', 'ASC']]
        });

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        
        doc.pipe(res);

        doc.fontSize(20).text('Ledenlijst Chiro Vreugdeland', { align: 'center' });
        doc.fontSize(12).text(`Export datum: ${new Date().toLocaleDateString('nl-BE')}`, { align: 'center' });
        if (mode === 'current') {
             doc.text(`Periode: ${where.period}`, { align: 'center' });
        }
        doc.moveDown();

        registrations.forEach((reg) => {
            if (doc.y > 700) doc.addPage();
            
            doc.fontSize(12).font('Helvetica-Bold').text(`${reg.firstName} ${reg.lastName} (${reg.group})`);
            doc.fontSize(10).font('Helvetica').text(`Periode: ${reg.period || 'Onbekend'} - Type: ${reg.type}`);
            doc.text(`Email: ${reg.email}`);
            doc.text(`Telefoon: ${reg.type === 'lid' ? reg.parentsPhone : reg.phone}`);
            if (reg.medicalInfo) doc.fillColor('red').text(`Medisch: ${reg.medicalInfo}`).fillColor('black');
            doc.moveDown(0.5);
        });

        doc.end();

    } catch (error) {
        console.error('Error exporting PDF:', error);
        // If headers sent, we can't redirect. But usually PDF generation is fast.
        if (!res.headersSent) {
            res.redirect('/admin/registrations?error=Kon PDF niet genereren');
        }
    }
};

exports.resetRegistrations = async (req, res) => {
    try {
        await Registration.destroy({ where: {}, truncate: false }); // SQLite truncate workaround
        res.redirect('/admin?success=Ledenlijst succesvol gewist.');
    } catch (error) {
        console.error('Reset Registrations Error:', error);
        res.redirect('/admin?error=Kon ledenlijst niet wissen.');
    }
};

exports.triggerBackup = (req, res) => {
    // Execute the existing backup script
    exec('node scripts/backup.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Backup error: ${error.message}`);
            return res.redirect('/admin?error=Backup mislukt: ' + encodeURIComponent(error.message));
        }
        console.log(`Backup output: ${stdout}`);
        res.redirect('/admin?success=Backup succesvol gemaakt!');
    });
};

exports.testPush = async (req, res) => {
    try {
        const users = await User.findAll();
        const messageData = {
            title: 'Testmelding',
            body: 'PWA push werkt!',
            url: '/feed'
        };

        const promises = users.map(user => NotificationService.sendIndividualNotification(user, messageData));
        await Promise.allSettled(promises);

        res.redirect('/admin?success=' + encodeURIComponent(`Test push verstuurd naar ${users.length} gebruikers (check logs voor details).`));
    } catch (error) {
        console.error('Test Push Error:', error);
        res.redirect('/admin?error=' + encodeURIComponent('Kon testmelding niet verzenden'));
    }
};

exports.resetWebsite = async (req, res) => {
    const { password } = req.body;
    
    if (!req.user) return res.redirect('/auth/login');

    try {
        const isMatch = await req.user.validatePassword(password);
        if (!isMatch) {
            return res.redirect('/admin?error=Fout wachtwoord. Reset geannuleerd.');
        }

        // Delete all data except Users and Uploads (Uploads are files, not DB)
        await Promise.all([
            Registration.destroy({ where: {}, truncate: false }),
            Leader.destroy({ where: {}, truncate: false }),
            Event.destroy({ where: {}, truncate: false }),
            PageContent.destroy({ where: {}, truncate: false })
        ]);

        // Delete all uploads (except .gitkeep)
        const uploadsDir = path.join(__dirname, '../public/uploads');
        fs.readdir(uploadsDir, (err, files) => {
            if (err) console.error('Error reading uploads dir:', err);
            else {
                for (const file of files) {
                    if (file !== '.gitkeep') {
                        fs.unlink(path.join(uploadsDir, file), err => {
                            if (err) console.error('Error deleting file:', file, err);
                        });
                    }
                }
            }
        });

        res.redirect('/admin?success=Website volledig gereset (inclusief afbeeldingen).');
    } catch (error) {
        console.error('Reset Website Error:', error);
        res.redirect('/admin?error=Er ging iets mis bij het resetten.');
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await User.findAll({ 
            where: {
                username: { [require('sequelize').Op.ne]: 'Admin' } // Exclude 'Admin'
            },
            order: [['username', 'ASC']] 
        });
        res.render('admin/users', { title: 'Beheer Gebruikers', users, user: req.user });
    } catch (error) {
        console.error('Error getting users:', error);
        res.redirect('/admin');
    }
};

exports.postUser = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const name = (username || '').trim();
        if (!name || !password) {
            return res.redirect('/admin/users?error=Vul een gebruikersnaam en wachtwoord in');
        }
        const exists = await User.findOne({ where: { username: name } });
        if (exists) {
            return res.redirect('/admin/users?error=Gebruikersnaam bestaat al');
        }
        const newUser = await User.create({ username: name, password, role });

        // Auto-assign to latest group if not admin
        if (role !== 'admin') {
            const latestGroup = await FeedGroup.findOne({
                order: [['year', 'DESC'], ['createdAt', 'DESC']]
            });
            if (latestGroup) {
                await UserGroupAccess.create({
                    userId: newUser.id,
                    feedGroupId: latestGroup.id,
                    role: 'member'
                });
            }
        }

        res.redirect('/admin/users');
    } catch (error) {
        console.error('Error creating user:', error);
        res.redirect('/admin/users?error=Kon gebruiker niet aanmaken');
    }
};

exports.deleteUser = async (req, res) => {
    if (req.params.id == req.user.id) {
        return res.redirect('/admin/users?error=Je kan jezelf niet verwijderen.');
    }
    try {
        const targetId = parseInt(req.params.id);
        const user = await User.findByPk(targetId);
        if (user) {
            await user.destroy();
        }
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.redirect('/admin/users?error=Kon gebruiker niet verwijderen.');
    }
};

exports.toggleUserStatus = async (req, res) => {
    if (req.params.id == req.user.id) {
        return res.redirect('/admin/users?error=Je kan jezelf niet deactiveren.');
    }
    try {
        const target = await User.findByPk(req.params.id);
        if (target) {
            // Toggle isActive. If it's null/undefined, treat as true (active), so toggle to false.
            // If it is false, toggle to true.
            // But DB default is true.
            const currentStatus = target.isActive === false ? false : true;
            await target.update({ isActive: !currentStatus });
        }
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.redirect('/admin/users?error=Kon status niet wijzigen.');
    }
};

exports.getFeedGroups = async (req, res) => {
    const groups = await FeedGroup.findAll({ order: [['year', 'DESC'], ['name', 'ASC']] });
    res.render('admin/feedgroups', { title: 'Leidingshoekjes', groups, user: req.user });
};

exports.postFeedGroup = async (req, res) => {
    try {
        let { name, year, description } = req.body;
        name = (name || '').trim();
        const base = (name + (year ? '-' + year : '')).toLowerCase();
        const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (!name) return res.redirect('/admin/feedgroups?error=Naam vereist');
        await FeedGroup.create({ name, year, description, slug });
        res.redirect('/admin/feedgroups');
    } catch (error) {
        console.error('Error creating feed group:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.redirect('/admin/feedgroups?error=Een groep met deze naam/jaar combinatie bestaat al.');
        }
        res.redirect('/admin/feedgroups?error=Kon groep niet aanmaken');
    }
};

exports.updateFeedGroup = async (req, res) => {
    try {
        const { id } = req.params;
        let { name, year, description } = req.body;
        const group = await FeedGroup.findByPk(id);
        if (!group) return res.redirect('/admin/feedgroups?error=Niet gevonden');

        name = (name || '').trim();
        const base = (name + (year ? '-' + year : '')).toLowerCase();
        const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        if (!name) return res.redirect('/admin/feedgroups?error=Naam vereist');

        await group.update({ name, year, description, slug });
        res.redirect('/admin/feedgroups?success=Aangepast');
    } catch (error) {
        console.error('Error updating feed group:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.redirect('/admin/feedgroups?error=Een groep met deze naam/jaar combinatie bestaat al.');
        }
        res.redirect('/admin/feedgroups?error=Kon groep niet bijwerken');
    }
};

exports.deleteFeedGroup = async (req, res) => {
    try {
        const group = await FeedGroup.findByPk(req.params.id);
        if (group) {
            await group.destroy();
        }
        res.redirect('/admin/feedgroups');
    } catch (error) {
        console.error('Error deleting feed group:', error);
        res.redirect('/admin/feedgroups?error=Kon groep niet verwijderen');
    }
};

exports.getEditUser = async (req, res) => {
    try {
        const target = await User.findByPk(req.params.id);
        if (!target) return res.redirect('/admin/users');
        const groups = await FeedGroup.findAll({ order: [['year', 'DESC'], ['name', 'ASC']] });
        const access = await UserGroupAccess.findAll({ where: { userId: target.id } });
        const accessIds = access.map(a => a.feedGroupId);
        res.render('admin/edit_user', { title: 'Gebruiker bewerken', target, groups, accessIds, user: req.user });
    } catch (error) {
        console.error('Error loading edit user:', error);
        res.redirect('/admin/users');
    }
};

exports.updateUser = async (req, res) => {
    try {
        const target = await User.findByPk(req.params.id);
        if (!target) return res.redirect('/admin/users');
        
        const updates = { role: req.body.role || target.role };
        const role = updates.role;
        
        // Handle password update if provided
        if (req.body.password && req.body.password.trim() !== '') {
            updates.password = req.body.password.trim();
        }

        await target.update(updates);

        const selected = req.body.groups;
        // Normalize to array of integers
        let selectedIds = [];
        if (Array.isArray(selected)) selectedIds = selected.map(id => parseInt(id));
        else if (selected) selectedIds = [parseInt(selected)];

        // Admins have access to all implicitly; clear explicit entries
        await UserGroupAccess.destroy({ where: { userId: target.id } });

        if (role !== 'admin' && selectedIds.length > 0) {
            await UserGroupAccess.bulkCreate(selectedIds.map(gid => ({ userId: target.id, feedGroupId: gid, role: 'member' })));
        }

        res.redirect('/admin/users');
    } catch (error) {
        console.error('Error updating user:', error);
        res.redirect('/admin/users?error=Kon gebruiker niet bijwerken');
    }
};

exports.getEmailTool = async (req, res) => {
    try {
        const currentPeriod = await PeriodService.getCurrentPeriod();
        const periodsData = await Registration.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('period')), 'period']],
            order: [['period', 'DESC']],
            raw: true
        });
        const periods = periodsData.map(p => p.period).filter(p => p);
        if (!periods.includes(currentPeriod)) periods.unshift(currentPeriod);

        res.render('admin/email_tool', { 
            title: 'Email Tool', 
            user: req.user, 
            periods, 
            currentPeriod 
        });
    } catch (error) {
        console.error('Error loading email tool:', error);
        res.redirect('/admin?error=Kon email tool niet laden');
    }
};

exports.postSendEmail = async (req, res) => {
    try {
        const { subject, body, recipient_type, individual_email, group_selection, period } = req.body;
        
        let recipients = [];

        if (recipient_type === 'individual') {
            if (!individual_email) throw new Error('Geen email adres ingevuld.');
            recipients.push(individual_email.trim());
        } else {
            // Group Selection
            const where = {};
            if (period) where.period = period;
            
            // Determine types to fetch
            let typesToFetch = [];
            if (group_selection === 'leiding') typesToFetch = ['leiding'];
            else if (group_selection === 'leden_ouders') typesToFetch = ['lid'];
            else if (group_selection === 'iedereen') typesToFetch = ['lid', 'leiding'];
            
            if (typesToFetch.length > 0) {
                where.type = { [require('sequelize').Op.in]: typesToFetch };
            }

            const registrations = await Registration.findAll({
                where,
                attributes: ['email']
            });
            
            // Extract and dedup emails
            const emails = registrations.map(r => r.email).filter(e => e && e.includes('@')); // Basic validation
            recipients = [...new Set(emails)]; // Deduplicate
        }

        if (recipients.length === 0) {
            return res.redirect('/admin/email?error=Geen ontvangers gevonden voor deze selectie.');
        }

        // Create HTML content
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { background-color: #db0029; color: #ffffff; padding: 30px 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
                    .content { padding: 30px; color: #333333; line-height: 1.6; }
                    .content img { max-width: 100%; height: auto; }
                    .footer { background-color: #333333; color: #cccccc; padding: 20px; text-align: center; font-size: 12px; }
                    .footer a { color: #cccccc; text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Chiro Vreugdeland</h1>
                    </div>
                    <div class="content">
                        ${body}
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Chiro Vreugdeland Meeuwen</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            subject: subject,
            html: htmlContent,
            from: process.env.MAIL_FROM || '"Chiro Vreugdeland" <noreply@chiromeeuwen.be>'
        };

        if (recipient_type === 'individual') {
            mailOptions.to = recipients[0];
        } else {
            mailOptions.to = process.env.MAIL_FROM || 'noreply@chiromeeuwen.be';
            mailOptions.bcc = recipients;
        }

        await sendMail(mailOptions);

        res.redirect(`/admin/email?success=Email succesvol verzonden naar ${recipients.length} ontvangers.`);

    } catch (error) {
        console.error('Error sending admin email:', error);
        res.redirect('/admin/email?error=' + encodeURIComponent('Fout bij verzenden: ' + error.message));
    }
};
