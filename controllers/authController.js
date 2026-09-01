const passport = require('passport');

exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login - Leiding', error: null }); // Handle error flash later
};

exports.postLogin = (req, res, next) => {
  // Capture the returnTo value BEFORE passport regenerates the session
  const returnTo = req.session.returnTo;

  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) { return res.redirect('/auth/login'); }
    req.logIn(user, (err) => {
      if (err) { return next(err); }

      const REMEMBER_ME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

      if (req.body.remember_me) {
        // Extend cookie AND tell the session it was modified so the store updates the expiry
        req.session.cookie.maxAge = REMEMBER_ME_MS;
        req.session.rememberMe = true; // flag so the store persists the extended TTL
      } else {
        // Short-lived persistent cookie: survives iOS PWA background suspension but expires after 1 day
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 day
        req.session.rememberMe = false;
      }

      // If returnTo existed in the old session, ensure it's cleared from the new one if it persisted
      if (req.session.returnTo) {
          delete req.session.returnTo;
      }

      req.session.save(() => {
          res.redirect(returnTo || '/feed');
      });
    });
  })(req, res, next);
};

exports.logout = async (req, res, next) => {
  // Remove the current device's push subscription before destroying the session.
  // This prevents notifications for this user from arriving on a device that is
  // now being used by a different person (shared-device / mobile scenario).
  if (req.user) {
    try {
      const endpoint = req.query.pushEndpoint || null;
      if (endpoint) {
        const { User } = require('../models');
        const user = await User.findByPk(req.user.id);
        if (user && user.pushSubscriptions && Array.isArray(user.pushSubscriptions)) {
          const filtered = user.pushSubscriptions.filter(s => s.endpoint !== endpoint);
          if (filtered.length !== user.pushSubscriptions.length) {
            user.pushSubscriptions = filtered;
            user.changed('pushSubscriptions', true);
            await user.save();
            console.log(`Auth: Removed push subscription for ${user.username} on logout`);
          }
        }
      }
    } catch (cleanupErr) {
      console.error('Push cleanup on logout error:', cleanupErr);
    }
  }

  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
};