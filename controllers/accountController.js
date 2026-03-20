const { User } = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendMail } = require('../config/mailer');
const fs = require('fs');
const path = require('path');

async function getSettingsContext(req, user = null) {
    const currentUser = user || await User.findByPk(req.user.id);
    let allUsers = [];
    let adminUser = null;

    if (currentUser.username === 'admin' || req.session.originalAdminId) {
        allUsers = await User.findAll({ where: { isActive: true }, order: [['username', 'ASC']] });
        adminUser = await User.findOne({ where: { username: 'admin' } });
    }

    return {
        title: 'Account Instellingen',
        user: currentUser,
        adminUser: adminUser,
        allUsers: allUsers,
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
        error: null,
        success: null
    };
}

exports.getSettings = async (req, res) => {
  try {
      const context = await getSettingsContext(req);
      res.render('account/settings', context);
  } catch (err) {
      console.error(err);
      res.render('error', {
          title: 'Fout',
          status: 500,
          message: 'Kon instellingen niet laden',
          description: 'Er is een fout opgetreden bij het laden van je instellingen.'
      });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
      if (!req.file) {
          const context = await getSettingsContext(req);
          return res.render('account/settings', { ...context, error: 'Geen bestand geüpload of bestandstype niet toegestaan.' });
      }

      const user = await User.findByPk(req.user.id);
      
      // Delete old profile picture if exists
      if (user.profilePicture) {
          const oldPath = path.join(__dirname, '../public', user.profilePicture);
          if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
          }
      }

      // Save new path relative to public folder
      user.profilePicture = '/uploads/profiles/' + req.file.filename;
      await user.save();
      
      const context = await getSettingsContext(req, user);
      res.render('account/settings', { ...context, success: 'Profielfoto bijgewerkt.' });

  } catch (err) {
      console.error(err);
      const context = await getSettingsContext(req);
      res.render('account/settings', { ...context, error: 'Kon profielfoto niet uploaden.' });
  }
};

exports.deleteProfilePicture = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        
        if (user.profilePicture) {
            const oldPath = path.join(__dirname, '../public', user.profilePicture);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
            user.profilePicture = null;
            await user.save();
        }

        const context = await getSettingsContext(req, user);
        res.render('account/settings', { ...context, success: 'Profielfoto verwijderd.' });
    } catch (err) {
        console.error(err);
        const context = await getSettingsContext(req);
        res.render('account/settings', { ...context, error: 'Kon profielfoto niet verwijderen.' });
    }
};

exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findByPk(req.user.id);
    const context = await getSettingsContext(req, user);

    if (newPassword !== confirmPassword) {
      return res.render('account/settings', { ...context, error: 'Nieuwe wachtwoorden komen niet overeen' });
    }

    const isMatch = await user.validatePassword(currentPassword);

    if (!isMatch) {
       return res.render('account/settings', { ...context, error: 'Huidig wachtwoord is onjuist' });
    }

    user.password = newPassword;
    await user.save();

    res.render('account/settings', { ...context, success: 'Wachtwoord succesvol gewijzigd' });
  } catch (err) {
    console.error(err);
    const context = await getSettingsContext(req);
    res.render('account/settings', { ...context, error: 'Er ging iets mis' });
  }
};

exports.subscribePush = async (req, res) => {
  try {
    const subscription = req.body;
    const user = await User.findByPk(req.user.id);

    let subscriptions = user.pushSubscriptions || [];
    
    // Ensure it is an array (in case of legacy data issues)
    if (!Array.isArray(subscriptions)) {
        subscriptions = [];
    }

    // Check if subscription already exists
    const exists = subscriptions.find(s => s.endpoint === subscription.endpoint);
    
    if (!exists) {
      subscriptions.push(subscription);
      user.pushSubscriptions = subscriptions;
      user.changed('pushSubscriptions', true); // Helper for Sequelize JSON updates
      await user.save();
    }

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
};

exports.unsubscribePush = async (req, res) => {
  try {
    const { endpoint } = req.body;
    const user = await User.findByPk(req.user.id);

    if (user.pushSubscriptions && Array.isArray(user.pushSubscriptions)) {
      const initialLength = user.pushSubscriptions.length;
      const newSubscriptions = user.pushSubscriptions.filter(s => s.endpoint !== endpoint);
      
      if (newSubscriptions.length !== initialLength) {
        user.pushSubscriptions = newSubscriptions;
        user.changed('pushSubscriptions', true);
        await user.save();
      }
    }

    res.status(200).json({ message: 'Unsubscribed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
};

exports.updateEmail = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    const context = await getSettingsContext(req, user);

    user.email = (email || '').trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
       return res.render('account/settings', { ...context, error: 'Ongeldig e-mailadres' });
    }

    user.emailVerified = false;
    user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
    await user.save();
    const verifyUrl = `${req.protocol}://${req.get('host')}/account/email/verify/${user.emailVerificationToken}`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background-color: #db0029; color: #ffffff; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
            .content { padding: 30px; color: #333333; line-height: 1.6; text-align: center; }
            .btn { display: inline-block; background-color: #db0029; color: #ffffff !important; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 20px; }
            .footer { background-color: #333333; color: #cccccc; padding: 20px; text-align: center; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Chiro Vreugdeland</h1>
            </div>
            <div class="content">
                <p>Dag <strong>${user.username || 'Chiro-vriend'}</strong>,</p>
                <p>Je hebt je e-mailadres gewijzigd of ingesteld. Klik op de onderstaande knop om je adres te bevestigen.</p>
                <a href="${verifyUrl}" class="btn">Verifieer E-mailadres</a>
                <p style="margin-top: 30px; font-size: 0.9em; color: #666;">Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Chiro Vreugdeland Meeuwen</p>
            </div>
        </div>
    </body>
    </html>
    `;

    await sendMail({
      to: user.email,
      subject: 'Verifieer je e-mailadres',
      text: `Bevestig je e-mailadres door deze link te openen: ${verifyUrl}`,
      html: html
    });
    res.render('account/settings', { ...context, success: 'Verificatiemail verzonden.' });
  } catch (err) {
    console.error(err);
    const context = await getSettingsContext(req);
    res.render('account/settings', { ...context, error: 'Kon e-mailadres niet bijwerken' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findByPk(req.user.id);
    const context = await getSettingsContext(req, user);
    
    if (!user || !user.emailVerificationToken || user.emailVerificationToken !== token) {
      return res.render('account/settings', { ...context, error: 'Ongeldige verificatielink' });
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailNotificationsEnabled = true; // Auto-enable notifications upon verification
    await user.save();
    res.render('account/settings', { ...context, success: 'E-mailadres geverifieerd' });
  } catch (err) {
    console.error(err);
    const context = await getSettingsContext(req);
    res.render('account/settings', { ...context, error: 'Kon e-mailadres niet verifiëren' });
  }
};

exports.toggleEmailNotifications = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const context = await getSettingsContext(req, user);

    if (!user.email || !user.emailVerified) {
      return res.render('account/settings', { ...context, error: 'Verifieer eerst je e-mailadres' });
    }
    const enabled = req.body.enabled === 'on' || req.body.enabled === 'true';
    user.emailNotificationsEnabled = enabled;
    await user.save();
    res.render('account/settings', { ...context, success: 'E-mailmeldingen bijgewerkt' });
  } catch (err) {
    console.error(err);
    const context = await getSettingsContext(req);
    res.render('account/settings', { ...context, error: 'Kon voorkeur niet opslaan' });
  }
};

exports.updateNotificationPreferences = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        
        const newPrefs = {
            newPost: req.body.newPost === 'on',
            mention: req.body.mention === 'on',
            comment: req.body.comment === 'on',
            reaction: req.body.reaction === 'on',
            birthday: req.body.birthday === 'on'
        };

        user.notificationPreferences = newPrefs;
        await user.save();
        
        const context = await getSettingsContext(req, user);
        res.render('account/settings', { ...context, success: 'Notificatievoorkeuren bijgewerkt.' });

    } catch (err) {
        console.error('Update Prefs Error:', err);
        const context = await getSettingsContext(req);
        res.render('account/settings', { ...context, error: 'Kon voorkeuren niet opslaan.' });
    }
};

exports.updateSecondaryAccount = async (req, res) => {
    try {
        if (req.user.username !== 'admin' && !req.session.originalAdminId) {
            return res.status(403).send('Niet toegestaan');
        }
        // Only the actual 'admin' user should be able to update their secondary account preference
        // If we're impersonating, we shouldn't really be changing the admin's settings this way
        // but let's allow it if the user is the 'admin' account.
        const user = await User.findOne({ where: { username: 'admin' } });
        if (user) {
            user.secondaryUserId = req.body.secondaryUserId || null;
            await user.save();
        }
        res.redirect('/account/settings');
    } catch (err) {
        console.error(err);
        res.redirect('/account/settings');
    }
};

exports.switchAccount = async (req, res) => {
    try {
        const currentUser = await User.findByPk(req.user.id);
        let targetUserId = null;
        let isSwitchingBack = false;
        let originalIdToKeep = req.session.originalAdminId;

        // If we are currently the admin, switch to secondary
        if (currentUser.username === 'admin') {
            if (!currentUser.secondaryUserId) {
                return res.redirect('/account/settings');
            }
            targetUserId = currentUser.secondaryUserId;
            originalIdToKeep = currentUser.id; // Mark this as the admin we're coming from
        } 
        // If we are impersonating (originalAdminId is in session), switch back to admin
        else if (req.session.originalAdminId) {
            targetUserId = req.session.originalAdminId;
            isSwitchingBack = true;
        } else {
            return res.status(403).send('Niet toegestaan');
        }

        if (targetUserId) {
            const targetUser = await User.findByPk(targetUserId);
            if (targetUser) {
                req.login(targetUser, (err) => {
                    if (err) {
                        console.error('Switch Login Error:', err);
                        return res.redirect('/account/settings');
                    }
                    
                    // Re-assign session variables as req.login might clear/regenerate session in some environments
                    if (isSwitchingBack) {
                        delete req.session.originalAdminId;
                    } else {
                        req.session.originalAdminId = originalIdToKeep;
                    }

                    // Explicitly save the session before redirecting
                    req.session.save((saveErr) => {
                        if (saveErr) {
                            console.error('Session Save Error:', saveErr);
                        }
                        return res.redirect('/');
                    });
                });
            } else {
                res.redirect('/account/settings');
            }
        } else {
            res.redirect('/account/settings');
        }
    } catch (err) {
        console.error('Switch Account Error:', err);
        res.redirect('/account/settings');
    }
};
