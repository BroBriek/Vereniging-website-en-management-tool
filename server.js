require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const methodOverride = require('method-override');
const { sequelize, syncDatabase } = require('./models');
const SQLiteStore = require('connect-sqlite3')(session);
const webpush = require('web-push');

// Init App
const app = express();

// Domain Enforcer & Redirect Middleware
app.use((req, res, next) => {
  const host = req.hostname;
  
  // Allow localhost and local IPs for development
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.endsWith('.local')) {
    return next();
  }
  
  // Redirect non-www to www
  if (host === 'chiromeeuwen.be') {
    return res.redirect(301, 'https://www.chiromeeuwen.be' + req.originalUrl);
  }
  
  // Allow valid production domains
  if (host === 'www.chiromeeuwen.be') {
    return next();
  }

  // Block everything else (including printmedialounge.de)
  res.status(404).send('Not Found');
});

// Passport Config
require('./config/passport')(passport);

// Database Sync
syncDatabase();

// Web Push VAPID configuration
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@chirosite.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Method Override (Query String & Body)
app.use(methodOverride('_method'));
app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
    var method = req.body._method
    delete req.body._method
    return method
  }
}));

// Sessions
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
  secret: process.env.SESSION_SECRET || 'secret_chiro_key_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Global Variables & Alert Middleware
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  
  // SEO headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Extract alerts from query params
  if (req.query.error) {
    res.locals.error = req.query.error;
  }
  if (req.query.success) {
    res.locals.success = req.query.success;
  }
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use('/feed', require('./routes/feed'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
      title: 'Pagina Niet Gevonden',
      status: 404,
      message: 'Oeps! Pagina niet gevonden',
      description: 'De pagina die je zoekt bestaat niet of is verplaatst.',
      user: req.user || null
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
      title: 'Server Fout',
      status: 500,
      message: 'Er ging iets mis',
      description: 'Onze excuses, er is een interne serverfout opgetreden.',
      user: req.user || null
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));