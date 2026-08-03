module.exports = {
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    
    // List of paths/extensions to ignore for returnTo
    const ignoredPaths = [
        '/favicon.ico',
        '/apple-touch-icon',
        '/robots.txt',
        '/sitemap.xml'
    ];
    
    const isIgnored = ignoredPaths.some(path => req.originalUrl.includes(path)) ||
                      req.originalUrl.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i);

    if (!isIgnored) {
        // Store original URL to redirect back after login
        req.session.returnTo = req.originalUrl;
        
        // Explicitly save session before redirecting to ensure persistence
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
            }
            res.redirect('/auth/login');
        });
    } else {
        res.redirect('/auth/login');
    }
  },
  ensureAdmin: function(req, res, next) {
      if (req.isAuthenticated() && req.user.role === 'admin') {
          return next();
      }
      // req.flash('error_msg', 'Geen toegang');
      res.redirect('/');
  },
  ensureMedia: function(req, res, next) {
      if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'media')) {
          return next();
      }
      res.redirect('/');
  },
  ensureGameAccess: function(req, res, next) {
      const showGamesToAll = process.env.SHOW_GAMES_TO_ALL !== 'false';
      if (showGamesToAll) {
          return next();
      }
      
      if (req.isAuthenticated() && req.user.username === 'admin') {
          return next();
      }
      
      res.redirect('/home');
  },
  ensureKookmoekeOrAdmin: function(req, res, next) {
      if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'kookmoeke')) {
          return next();
      }
      res.redirect('/');
  }
};