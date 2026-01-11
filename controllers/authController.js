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