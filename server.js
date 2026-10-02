process.env.TZ = 'Europe/Brussels';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const util = require('util');

const LOGS_DIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });
const stdoutLogPath = path.join(LOGS_DIR, 'stdout.log');
const stderrLogPath = path.join(LOGS_DIR, 'stderr.log');
const stdoutLogStream = fs.createWriteStream(stdoutLogPath, { flags: 'a' });
const stderrLogStream = fs.createWriteStream(stderrLogPath, { flags: 'a' });

const pad = n => String(n).padStart(2, '0');
const getTimestamp = () => {
  const d = new Date();
  return `[${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`;
};

const originalConsoleLog = console.log.bind(console);
const originalConsoleInfo = console.info.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);
const originalConsoleDebug = (console.debug || console.log).bind(console);

const writeLog = (stream, originalConsoleMethod, args) => {
  if (args.length === 0) {
    stream.write('\n');
    originalConsoleMethod();
    return;
  }
  const timestamp = getTimestamp();
  const formatted = util.format(...args);
  stream.write(`${timestamp} ${formatted}\n`);
  originalConsoleMethod(`${timestamp} ${formatted}`);
};

console.log = (...args) => writeLog(stdoutLogStream, originalConsoleLog, args);
console.info = (...args) => writeLog(stdoutLogStream, originalConsoleInfo, args);
console.warn = (...args) => writeLog(stderrLogStream, originalConsoleWarn, args);
console.error = (...args) => writeLog(stderrLogStream, originalConsoleError, args);
console.debug = (...args) => writeLog(stdoutLogStream, originalConsoleDebug, args);

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const methodOverride = require('method-override');
const { sequelize, syncDatabase } = require('./models');
const SQLiteStore = require('connect-sqlite3')(session);
const webpush = require('web-push');
const SettingsService = require('./services/SettingsService');
const CustomPageService = require('./services/CustomPageService');
const BackupService = require('./services/BackupService');
const logMonitor = require('./services/LogMonitorService');
const onlineUserService = require('./services/OnlineUserService');

// Init App
const app = express();

// Domain Enforcer & Redirect Middleware
app.use((req, res, next) => {
  const host = req.hostname;
  
  // Allow localhost and local IPs for development
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.endsWith('.local') || host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok.io') || host.endsWith('.ngrok-free.dev')) {
    return next();
  }
  
  const appDomain = process.env.APP_DOMAIN;
  if (appDomain) {
    const rawAllowed = process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',') : [appDomain, `www.${appDomain}`];
    const allowedDomains = rawAllowed.map(d => d.trim().toLowerCase()).filter(Boolean);
    
    // Redirect non-www to www if root domain was requested
    if (host.toLowerCase() === appDomain.toLowerCase() && !appDomain.startsWith('www.')) {
      return res.redirect(301, `https://www.${appDomain}${req.originalUrl}`);
    }
    
    // Allow valid configured domains
    if (allowedDomains.includes(host.toLowerCase())) {
      return next();
    }
    
    // Block unallowed domains
    return res.status(404).send('Not Found');
  }

  // If no APP_DOMAIN configured, allow request
  next();
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
    `mailto:${process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_USER || process.env.IONOS_EMAIL || 'admin@example.com'}`,
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

// Trust proxy (required for secure session cookies over HTTPS behind reverse proxies on VPS)
app.set('trust proxy', 1);

// Sessions
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  const secretPath = path.join(__dirname, '.session_secret');
  try {
    if (fs.existsSync(secretPath)) {
      sessionSecret = fs.readFileSync(secretPath, 'utf8').trim();
      console.warn('⚠️ WARNING: SESSION_SECRET environment variable is missing. Loaded persistent fallback secret from .session_secret.');
    } else {
      sessionSecret = require('crypto').randomBytes(32).toString('hex');
      fs.writeFileSync(secretPath, sessionSecret, 'utf8');
      console.warn('⚠️ WARNING: SESSION_SECRET environment variable is missing. Generated new persistent fallback secret and saved to .session_secret.');
    }
  } catch (err) {
    console.error('❌ Failed to handle persistent fallback session secret:', err);
    sessionSecret = require('crypto').randomBytes(32).toString('hex');
    console.warn('⚠️ WARNING: SESSION_SECRET environment variable is missing. Using temporary in-memory fallback secret.');
  }
}

const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Patch express-session Cookie prototype so that serialized cookie headers include 'Max-Age' (in seconds).
// Modern mobile browsers (especially Android Chromium / PWA WebAPKs) use Max-Age to maintain persistent
// sessions reliably across reboots and network switches, preventing premature session eviction due to clock skew.
const Cookie = require('express-session/session/cookie');
const origCookieData = Object.getOwnPropertyDescriptor(Cookie.prototype, 'data');
if (origCookieData && origCookieData.get) {
  Object.defineProperty(Cookie.prototype, 'data', {
    get: function() {
      const data = origCookieData.get.call(this);
      if (this._expires && this.maxAge != null) {
        data.maxAge = Math.max(0, Math.floor(this.maxAge / 1000));
      }
      return data;
    }
  });
}

// Patch connect-sqlite3 methods to prevent double-callbacks on errors and handle edge cases safely
SQLiteStore.prototype.get = function(sid, fn) {
  const now = new Date().getTime();
  this.db.get('SELECT sess FROM ' + this.table + ' WHERE sid = ? AND ? <= expired', [sid, now],
    (err, row) => {
      if (err) return fn(err);
      if (!row) return fn();
      try {
        fn(null, JSON.parse(row.sess));
      } catch (parseErr) {
        fn(parseErr);
      }
    }
  );
};

SQLiteStore.prototype.touch = function(sid, session, fn) {
  if (session && session.cookie && session.cookie.expires) {
    const now = new Date().getTime();
    const cookieExpires = new Date(session.cookie.expires).getTime();
    this.db.run('UPDATE ' + this.table + ' SET expired=? WHERE sid = ? AND ? <= expired',
      [cookieExpires, sid, now],
      (err) => {
        if (fn) {
          if (err) return fn(err);
          return fn();
        }
      }
    );
  } else {
    if (fn) fn();
  }
};

const sessionStore = new SQLiteStore({
  db: 'sessions.sqlite',
  dir: '.',
  concurrentDb: true, // Enables SQLite WAL mode for concurrency
  table: 'sessions',
  // Keep sessions in the DB for up to 30 days so that "remember me" sessions survive
  ttl: REMEMBER_ME_DURATION / 1000, // connect-sqlite3 expects seconds
});

// Configure busy timeout on SQLite connection so concurrent requests retry instead of throwing SQLITE_BUSY
if (sessionStore.db) {
  if (typeof sessionStore.db.configure === 'function') {
    sessionStore.db.configure('busyTimeout', 5000);
  }
  sessionStore.db.run('PRAGMA busy_timeout = 5000;');
}

app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Refresh cookie expiry on every request (prevents iOS ITP 7-day eviction)
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // Default: 1 day; overridden to 30 days on login with "remember me"
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Persistent Session Refresh Middleware:
// For users who checked "Blijf ingelogd" (rememberMe: true), ensure their cookie maxAge
// is continuously maintained at 30 days on each active request, matching SQLite store TTL.
app.use((req, res, next) => {
  if (req.session && req.session.rememberMe) {
    req.session.cookie.maxAge = REMEMBER_ME_DURATION;
  }
  next();
});

const crypto = require('crypto');

// Helper to safely format form action URL: only keeps/adds _csrf for multipart forms, cleans it from standard forms
function formatActionUrl(action, isMultipart, csrfToken) {
  if (!action) {
    return isMultipart ? `?_csrf=${csrfToken}` : '';
  }
  try {
    const isRelative = !action.startsWith('http://') && !action.startsWith('https://');
    const dummyBase = 'http://localhost';
    const parsed = new URL(action, dummyBase);
    if (isMultipart) {
      parsed.searchParams.set('_csrf', csrfToken);
    } else {
      parsed.searchParams.delete('_csrf');
    }
    const search = parsed.search;
    const hash = parsed.hash;
    const pathname = isRelative ? (action.startsWith('/') ? parsed.pathname : parsed.pathname.replace(/^\//, '')) : parsed.origin + parsed.pathname;
    return `${pathname}${search}${hash}`;
  } catch (e) {
    return action;
  }
}

// Timing-safe string comparison to prevent timing attacks
function safeCompareTokens(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// CSRF Generation & Auto-Injection Middleware
app.use((req, res, next) => {
  if (!req.session) return next();

  // Generate CSRF token if not already exists in the session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  // Expose token to all views
  res.locals.csrfToken = req.session.csrfToken;

  // Intercept res.send to auto-inject CSRF hidden input to POST forms (and query param ONLY for multipart forms)
  const originalSend = res.send;
  res.send = function (body) {
    if (typeof body === 'string' && body.includes('</form>') && req.session && req.session.csrfToken) {
      const csrfToken = req.session.csrfToken;
      const csrfInput = `<input type="hidden" name="_csrf" value="${csrfToken}">`;
      body = body.replace(/(<form\b[^>]*method=["']?post["']?[^>]*>)/gi, (formTag) => {
        const isMultipart = /enctype=["']?multipart\/form-data["']?/i.test(formTag);
        const actionMatch = formTag.match(/action=["']([^"']*)["']/i);
        
        if (actionMatch) {
          const updatedAction = formatActionUrl(actionMatch[1], isMultipart, csrfToken);
          const updatedFormTag = formTag.replace(/action=["'][^"']*["']/i, `action="${updatedAction}"`);
          return `${updatedFormTag}${csrfInput}`;
        } else if (isMultipart) {
          const updatedFormTag = formTag.replace(/(<form\b)/i, `$1 action="?_csrf=${csrfToken}"`);
          return `${updatedFormTag}${csrfInput}`;
        } else {
          return `${formTag}${csrfInput}`;
        }
      });
    }
    return originalSend.call(this, body);
  };
  
  next();
});

// CSRF Validation Middleware
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method)) {
    return next();
  }

  const getSingleToken = (val) => {
    if (!val) return null;
    if (Array.isArray(val)) return val[val.length - 1];
    return typeof val === 'string' ? val : null;
  };

  const token = (req.body && getSingleToken(req.body._csrf)) ||
                (req.query && getSingleToken(req.query._csrf)) ||
                getSingleToken(req.headers['x-csrf-token'] || req.headers['x-xsrf-token']);

  const sessionToken = req.session ? req.session.csrfToken : null;

  if (!token || !sessionToken || !safeCompareTokens(token, sessionToken)) {
    // Check if the targeted route is part of the application
    const isKnownAppPath = /^\/(auth|account|admin|feed|tetterhoekje|kampboekje|quotes|games|inschrijven|contact|forms)($|\/)/i.test(req.path);

    // If it's a known application path, log to stdout using console.log (NOT console.warn which routes to stderr and triggers PM2 error monitors)
    if (isKnownAppPath) {
      console.log(`[CSRF Blocked] ${req.method} ${req.originalUrl} - IP: ${req.ip || req.connection.remoteAddress}`);
    }

    // Graceful redirects for user-facing forms when a session expired
    if (req.originalUrl.startsWith('/auth/login') || req.path === '/login') {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Je sessie is verlopen. Log opnieuw in.'));
    }

    if (req.originalUrl.startsWith('/inschrijven')) {
      return res.redirect('/inschrijven?error=' + encodeURIComponent('Je sessie is verlopen omdat het formulier te lang open stond. Probeer het opnieuw.'));
    }

    if (req.xhr || req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({ error: 'Sessie verlopen of ongeldige CSRF-token. Vernieuw de pagina.' });
    }

    // For automated scanners hitting non-existent endpoints (/graphql, /api/fs/exec, /inngest, etc.), return 404 rather than 403
    if (!isKnownAppPath) {
      return res.status(404).render('error', {
        title: 'Pagina Niet Gevonden',
        status: 404,
        message: 'Oeps! Pagina niet gevonden',
        description: 'De pagina die je zoekt bestaat niet of is verplaatst.',
        user: req.user || null
      });
    }

    return res.status(403).send('Forbidden: Invalid or missing CSRF token');
  }

  next();
}

app.use(csrfProtection);

// Prevent caching of session-authenticated routes to avoid session leaks via proxies
app.use((req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Global Variables & Alert Middleware
app.use((req, res, next) => {
  onlineUserService.recordActivity(req);
  res.locals.settings = SettingsService.getAll() || {};
  res.locals.navbarPages = CustomPageService.getNavbarPages();
  res.locals.user = req.user || null;
  res.locals.originalAdminId = req.session ? req.session.originalAdminId : null;
  res.locals.enablePublicRegistrations = res.locals.settings.enable_public_registrations_view;
  res.locals.showGamesToAll = res.locals.settings.show_games_to_all;
  
  // Organization and contact configuration
  res.locals.orgName = process.env.ORG_NAME || process.env.ORGANIZATION_NAME || 'Chiro Vreugdeland';
  res.locals.orgLocation = process.env.ORG_LOCATION || 'Meeuwen';
  res.locals.orgFullName = process.env.ORG_FULL_NAME || `${res.locals.orgName} ${res.locals.orgLocation}`.trim();
  res.locals.contactEmail = process.env.CONTACT_EMAIL || 'contact@example.com';
  res.locals.appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  
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
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.quilljs.com https://www.google.com https://www.gstatic.com blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.quilljs.com https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; frame-src 'self' https://www.google.com https://docs.google.com https://view.officeapps.live.com https://recaptcha.google.com blob:; connect-src 'self' https://www.google.com https://cdn.jsdelivr.net;");
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

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Te veel inlogpogingen vanaf dit IP-adres, probeer het na een minuut opnieuw.',
  handler: (req, res, next, options) => {
    return res.redirect('/auth/login?error=' + encodeURIComponent(options.message));
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/auth/login', loginLimiter);

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use('/feed', require('./routes/feed'));
app.use('/tetterhoekje', require('./routes/tetterhoekje'));
app.use('/kampboekje', require('./routes/kampboekje'));
app.use('/quotes', require('./routes/quote'));
app.use('/games', require('./routes/game'));

// Multer Error Handling Middleware
app.use((err, req, res, next) => {
  if (err.name === 'MulterError' || (err.message && err.message.includes('Ongeldig bestandstype'))) {
    const referrer = req.get('Referrer') || '/';
    const cleanReferrer = referrer.replace(/([?&])(error|success)=[^&]*/g, '').replace(/[\?&]$/, '');
    const cleanSeparator = cleanReferrer.includes('?') ? '&' : '?';
    return res.redirect(cleanReferrer + cleanSeparator + 'error=' + encodeURIComponent(err.message));
  }
  next(err);
});

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