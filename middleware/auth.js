module.exports = {
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    // Store original URL to redirect back after login
    req.session.returnTo = req.originalUrl;
    
    // Assuming we use flash messages
    // req.flash('error_msg', 'Gelieve eerst in te loggen');
    res.redirect('/auth/login');
  },
  ensureAdmin: function(req, res, next) {
      if (req.isAuthenticated() && req.user.role === 'admin') {
          return next();
      }
      // req.flash('error_msg', 'Geen toegang');
      res.redirect('/');
  }
};