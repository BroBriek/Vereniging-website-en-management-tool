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
    await sendMail({
      to: user.email,
      subject: 'Verifieer je e-mailadres',
      text: `Bevestig je e-mailadres door deze link te openen: ${verifyUrl}`,
      html: `<p>Bevestig je e-mailadres voor ChiroSite.</p><p><a href="${verifyUrl}">Verifieer</a></p>`
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
