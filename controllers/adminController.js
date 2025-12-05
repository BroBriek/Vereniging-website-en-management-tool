const { PageContent, Leader, Event, Registration, User, Post, Comment, PostResponse } = require('../models');
const webpush = require('web-push');
const ExcelJS = require('exceljs');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

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
    
    res.redirect(`/admin/page/${slug}`);
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
    const registrations = await Registration.findAll({
        order: [
            ['group', 'ASC'],
            ['type', 'DESC'], // 'leiding' > 'lid' ?? 'leiding' comes after 'lid' alphabetically. 'lid' vs 'leiding'. 'leiding' should be first.
                              // 'leiding' > 'lid' alphabetically? 'e' vs 'i'. 'leiding' is first alphabetically. 
                              // So ASC: leiding, lid. DESC: lid, leiding.
                              // Wait, 'l' is same. 'e' (5) < 'i' (9). So 'leiding' < 'lid'.
                              // So ASC sorting puts 'leiding' before 'lid'. Correct.
            ['lastName', 'ASC']
        ]
    });
    res.render('admin/registrations', { title: 'Inschrijvingen', registrations, user: req.user });
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
    const registrations = await Registration.findAll({
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
        const payload = JSON.stringify({
            title: 'Testmelding',
            body: 'PWA push werkt!'
        });

        let sent = 0;
        for (const user of users) {
            if (user.pushSubscriptions && Array.isArray(user.pushSubscriptions)) {
                let subChanged = false;
                for (let i = user.pushSubscriptions.length - 1; i >= 0; i--) {
                    const sub = user.pushSubscriptions[i];
                    try {
                        await webpush.sendNotification(sub, payload);
                        sent++;
                    } catch (err) {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            user.pushSubscriptions.splice(i, 1);
                            subChanged = true;
                        }
                        console.error('Test push error:', err && err.message ? err.message : err);
                    }
                }
                if (subChanged) {
                    user.pushSubscriptions = [...user.pushSubscriptions];
                    user.changed('pushSubscriptions', true);
                    await user.save();
                }
            }
        }

        res.redirect('/admin?success=' + encodeURIComponent(`Test push verzonden naar ${sent} subscriptions`));
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
        await User.create({ username: name, password, role });
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
        const t = await require('../models').sequelize.transaction();
        try {
            const posts = await Post.findAll({ where: { authorId: targetId }, transaction: t });
            const postIds = posts.map(p => p.id);

            if (postIds.length > 0) {
                await Comment.destroy({ where: { postId: postIds }, transaction: t });
                await PostResponse.destroy({ where: { postId: postIds }, transaction: t });
                await Post.destroy({ where: { id: postIds }, transaction: t });
            }

            await Comment.update({ userId: null }, { where: { userId: targetId }, transaction: t });
            await PostResponse.update({ userId: null }, { where: { userId: targetId }, transaction: t });

            await User.destroy({ where: { id: targetId }, transaction: t });
            await t.commit();
            res.redirect('/admin/users');
        } catch (err) {
            await t.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        res.redirect('/admin/users?error=Kon gebruiker niet verwijderen.');
    }
};
