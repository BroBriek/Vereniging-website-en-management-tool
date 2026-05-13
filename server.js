process.env.TZ = 'Europe/Brussels';
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const util = require('util');
const session = require('express-session');
const passport = require('passport');
const methodOverride = require('method-override');
const { sequelize, syncDatabase } = require('./models');
const SQLiteStore = require('connect-sqlite3')(session);
const webpush = require('web-push');
const SettingsService = require('./services/SettingsService');
const CustomPageService = require('./services/CustomPageService');
const BackupService = require('./services/BackupService');

const LOGS_DIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });
const stdoutLogPath = path.join(LOGS_DIR, 'stdout.log');
const stderrLogPath = path.join(LOGS_DIR, 'stderr.log');
const stdoutLogStream = fs.createWriteStream(stdoutLogPath, { flags: 'a' });
const stderrLogStream = fs.createWriteStream(stderrLogPath, { flags: 'a' });
const formatConsoleArgs = (...args) => util.format(...args) + '\n';

const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
console.log = (...args) => {
  stdoutLogStream.write(formatConsoleArgs(...args));
  originalConsoleLog(...args);
};
console.error = (...args) => {
  stderrLogStream.write(formatConsoleArgs(...args));
  originalConsoleError(...args);
};

// Init App
const app = express();

// Domain Enforcer & Redirect Middleware
app.use((req, res, next) => {
  const host = req.hostname;
  
  
  // Allow localhost and local IPs for development
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.endsWith('.local') || host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok.io') || host.endsWith('.ngrok-free.dev')) {
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

// Trailing Slash Normalization Middleware (301 redirects for SEO)
// Redirects all trailing slash URLs to non-trailing slash versions (except root)
app.use((req, res, next) => {
  // Skip for localhost/development environments
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname.startsWith('192.168.') || req.hostname.endsWith('.local')) {
    return next();
  }
  
  // If path has trailing slash and is not root, redirect to non-trailing version
  if (req.path.length > 1 && req.path.endsWith('/')) {
    const normalizedPath = req.path.slice(0, -1);
    const redirectUrl = normalizedPath + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
    return res.redirect(301, redirectUrl);
  }
  
  next();
});

// Passport Config
require('./config/passport')(passport);

// Database Sync
syncDatabase().then(() => {
  SettingsService.init();
  CustomPageService.init();
});

// Web Push VAPID configuration
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.IONOS_EMAIL || 'example@example.com'}`,
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
  cookie: { maxAge: null } // Session cookie (expires on browser close)
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Global Variables & Alert Middleware
app.use((req, res, next) => {
  res.locals.settings = SettingsService.getAll() || {};
  res.locals.navbarPages = CustomPageService.getNavbarPages();
  res.locals.user = req.user || null;
  res.locals.originalAdminId = req.session ? req.session.originalAdminId : null;
  res.locals.enablePublicRegistrations = res.locals.settings.enable_public_registrations_view;
  res.locals.showGamesToAll = res.locals.settings.show_games_to_all;
  
  // Normalize currentPath for SEO (remove trailing slash unless root)
  let normalizedPath = req.path;
  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  res.locals.currentPath = normalizedPath;
  
  // Helper for capitalizing names
  res.locals.capitalizeName = (name) => {
    if (!name) return '';
    return name.toString().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  };

  // Helper for avatar colors
  res.locals.getAvatarColor = (username) => {
    if (!username) return '#db3e41';
    const vibrantColors = ['#f1c40f', '#2ecc71', '#e67e22', '#e74c3c', '#3498db', '#9b59b6', '#1abc9c', '#d35400'];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return vibrantColors[Math.abs(hash) % vibrantColors.length];
  };

  // Helper for initials
  res.locals.getInitials = (username) => {
    if (!username) return '?';
    return username.substring(0, 2).toUpperCase();
  };
  
  // Security headers
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.quilljs.com https://www.google.com https://www.gstatic.com blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.quilljs.com https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; frame-src 'self' https://www.google.com https://docs.google.com https://view.officeapps.live.com https://recaptcha.google.com blob:; connect-src 'self' https://www.google.com;");
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
app.use('/quotes', require('./routes/quote'));
app.use('/games', require('./routes/game'));

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
  logMonitor.notifyError(err, `Express error at ${req.method} ${req.originalUrl}`);
  res.status(500).render('error', {
      title: 'Server Fout',
      status: 500,
      message: 'Er ging iets mis',
      description: 'Onze excuses, er is een interne serverfout opgetreden.',
      user: req.user || null
  });
});

const logMonitor = require('./services/LogMonitorService');

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    logMonitor.init();
    // Initialize Birthday Notifications
    require('./services/BirthdayService').init();
    // Initialize Weekly Registration Update
    require('./services/RegistrationUpdateService').init();
    // Initialize GDPR Medical Info Cleanup
    require('./services/GdprCleanupService').init();
    // Initialize Monthly Backup
    const backupService = new BackupService();
    backupService.scheduleMonthlyBackup();
});