const { User } = require('../models');
const bcrypt = require('bcrypt');

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
    res.status(500).send('Server Error');
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
