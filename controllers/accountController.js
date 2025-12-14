const { User } = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendMail } = require('../config/mailer');

exports.getSettings = (req, res) => {
  res.render('account/settings', {
    title: 'Account Instellingen',
    user: req.user,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    error: null,
    success: null
  });
};

exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Default render context
  const renderContext = {
    title: 'Account Instellingen',
    user: req.user,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    error: null,
    success: null
  };

  if (newPassword !== confirmPassword) {
    return res.render('account/settings', { ...renderContext, error: 'Nieuwe wachtwoorden komen niet overeen' });
  }

  try {
    const user = await User.findByPk(req.user.id);
    const isMatch = await user.validatePassword(currentPassword);

    if (!isMatch) {
       return res.render('account/settings', { ...renderContext, error: 'Huidig wachtwoord is onjuist' });
    }

    user.password = newPassword;
    await user.save();

    res.render('account/settings', { ...renderContext, success: 'Wachtwoord succesvol gewijzigd' });
  } catch (err) {
    console.error(err);
    res.render('account/settings', { ...renderContext, error: 'Er ging iets mis' });
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

exports.updateEmail = async (req, res) => {
  const { email } = req.body;
  const renderContext = {
    title: 'Account Instellingen',
    user: req.user,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    error: null,
    success: null
  };
  try {
    const user = await User.findByPk(req.user.id);
    user.email = (email || '').trim();
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
    res.render('account/settings', { ...renderContext, success: 'Verificatiemail verzonden.' });
  } catch (err) {
    console.error(err);
    res.render('account/settings', { ...renderContext, error: 'Kon e-mailadres niet bijwerken' });
  }
};

exports.verifyEmail = async (req, res) => {
  const renderContext = {
    title: 'Account Instellingen',
    user: req.user,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    error: null,
    success: null
  };
  try {
    const { token } = req.params;
    const user = await User.findByPk(req.user.id);
    if (!user || !user.emailVerificationToken || user.emailVerificationToken !== token) {
      return res.render('account/settings', { ...renderContext, error: 'Ongeldige verificatielink' });
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    await user.save();
    res.render('account/settings', { ...renderContext, success: 'E-mailadres geverifieerd' });
  } catch (err) {
    console.error(err);
    res.render('account/settings', { ...renderContext, error: 'Kon e-mailadres niet verifiëren' });
  }
};

exports.toggleEmailNotifications = async (req, res) => {
  const renderContext = {
    title: 'Account Instellingen',
    user: req.user,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    error: null,
    success: null
  };
  try {
    const user = await User.findByPk(req.user.id);
    if (!user.email || !user.emailVerified) {
      return res.render('account/settings', { ...renderContext, error: 'Verifieer eerst je e-mailadres' });
    }
    const enabled = req.body.enabled === 'on' || req.body.enabled === 'true';
    user.emailNotificationsEnabled = enabled;
    await user.save();
    res.render('account/settings', { ...renderContext, success: 'E-mailmeldingen bijgewerkt' });
  } catch (err) {
    console.error(err);
    res.render('account/settings', { ...renderContext, error: 'Kon voorkeur niet opslaan' });
  }
};
