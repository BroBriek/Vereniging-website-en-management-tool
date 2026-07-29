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
        // Session cookie: expires when browser closes
        req.session.cookie.maxAge = null;
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

exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
};