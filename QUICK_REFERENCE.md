# Quick Reference: Organization Customization

## First Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Run interactive setup tool (RECOMMENDED)
node scripts/setup-organization.js

# 3. Start the application
node server.js

# 4. Access admin dashboard
# URL: http://localhost:3000/admin
# Default credentials: leiding / chiro
# IMPORTANT: Change password immediately!
```

## Configuration Variables

All variables are optional - application uses sensible defaults.

### Essential Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `ORG_FULL_NAME` | Organization name with city | `Chiro Amsterdam West` |
| `ORG_DOMAIN_WWW` | Website domain | `www.chiro-amsterdam.nl` |
| `ORG_EMAIL` | Contact email | `contact@chiro-amsterdam.nl` |
| `SESSION_SECRET` | Session security key | Random 32+ char string |
| `NODE_ENV` | Environment | `development` or `production` |

### All Variables

**Organization**
- `ORG_NAME` - Basic name
- `ORG_FULL_NAME` - Name with city
- `ORG_SHORT_NAME` - Navbar display
- `ORG_CITY` - City name
- `ORG_REGION` - Region/province
- `ORG_POSTAL_CODE` - ZIP code
- `ORG_ADDRESS` - Street address

**Web**
- `ORG_DOMAIN` - Domain without www
- `ORG_DOMAIN_WWW` - Domain with www
- `ORG_BASE_URL` - Full URL with protocol

**Contact**
- `ORG_EMAIL` - Main email
- `ORG_NOREPLY_EMAIL` - Automated email
- `ORG_EMAIL_NAME` - Email display name
- `ORG_FACEBOOK` - Facebook page name

**SEO**
- `ORG_KEYWORDS` - Meta keywords
- `ORG_DEFAULT_DESC` - Page description
- `ORG_TAGLINE` - Organization motto

**Colors**
- `ORG_PRIMARY_COLOR` - Main color (hex)
- `ORG_SECONDARY_COLOR` - Accent color (hex)
- `ORG_BG_COLOR` - Background (hex)
- `ORG_THEME_COLOR` - Browser UI (hex)

**Legal**
- `ORG_LEGAL_NAME` - Legal entity name
- `ORG_FOUNDING_YEAR` - Year founded
- `ORG_VAT_NUMBER` - VAT ID (optional)

**Features**
- `ENABLE_NEWSLETTER` - true/false
- `ENABLE_MERCHANDISE` - true/false
- `ENABLE_CALENDAR` - true/false
- `ENABLE_REGISTRATIONS` - true/false
- `ENABLE_FINANCE` - true/false

## Common Tasks

### Change Organization Name

**Option A: Setup Script**
```bash
node scripts/setup-organization.js
# Select your organization when prompted
```

**Option B: Edit .env**
```env
ORG_NAME=Chiro MyCity
ORG_FULL_NAME=Chiro MyCity Amsterdam
ORG_SHORT_NAME=CHIRO MYCITY
```

Then restart: `node server.js`

### Change Brand Colors

**Via Admin Dashboard:**
1. Log in to `/admin`
2. Go to Organization Settings
3. Update color fields
4. Save

**Via .env:**
```env
ORG_PRIMARY_COLOR=#ff0000
ORG_SECONDARY_COLOR=#ffd700
ORG_THEME_COLOR=#ff0000
```

### Disable a Feature

```env
ENABLE_MERCHANDISE=false      # Hides merchandise page
ENABLE_CALENDAR=false         # Hides calendar
ENABLE_REGISTRATIONS=false    # Hides signup form
```

### Change Contact Email

```env
ORG_EMAIL=newemail@example.be
ORG_NOREPLY_EMAIL=noreply@example.be
```

Also update footer content in admin dashboard.

### Set Up Email Notifications

Choose ONE provider and uncomment in `.env`:

**Gmail:**
```env
GMAIL_EMAIL=your@gmail.com
GMAIL_PASSWORD=app-specific-password
```

**Outlook:**
```env
OUTLOOK_EMAIL=your@outlook.com
OUTLOOK_PASSWORD=your-password
```

**Ionos:**
```env
IONOS_EMAIL=your@ionos.de
IONOS_PASSWORD=your-password
IONOS_HOST=smtp.ionos.de
IONOS_PORT=587
```

**MailerSend:**
```env
MAILERSEND_API_KEY=your-api-key
MAILERSEND_SMTP_USER=smtp-user
MAILERSEND_SMTP_PASS=smtp-password
```

### Enable Push Notifications

1. Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```

2. Add to `.env`:
```env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

3. Restart application

## Default Values

If a variable is not set, application uses these defaults:

```
ORG_NAME = Chiro Vreugdeland
ORG_FULL_NAME = Chiro Vreugdeland Meeuwen
ORG_DOMAIN_WWW = www.chiromeeuwen.be
ORG_EMAIL = Chiromeeuwen@outlook.com
ORG_PRIMARY_COLOR = #db3e41 (Chiro red)
ORG_SECONDARY_COLOR = #ffd800 (Chiro yellow)
PORT = 3000
NODE_ENV = development
```

## Admin Dashboard

After login, customize:

- **Home Page** - `/admin/page/home`
- **Leaders** - `/admin/leaders`
- **Events** - `/admin/events`
- **Finance** - `/admin/finance`
- **Organization Settings** - `/admin/organization-settings`

Default admin credentials: `leiding` / `chiro`

**⚠️ Change password immediately after first login!**

## File Locations

| File | Purpose |
|------|---------|
| `config/organization.js` | Configuration module |
| `.env` | Environment variables |
| `.env.example` | Configuration template |
| `scripts/setup-organization.js` | Setup tool |
| `docs/ORGANIZATION_SETUP.md` | Detailed guide |
| `docs/MULTI_ORGANIZATION_GUIDE.md` | Multi-org guide |

## Troubleshooting

### Changes not appearing?
1. Check `.env` file is saved
2. Restart application: `node server.js`
3. Clear browser cache (Ctrl+Shift+Delete)

### Email not sending?
1. Check email provider credentials in `.env`
2. Verify only ONE provider is uncommented
3. Check email logs in admin dashboard

### Domain not redirecting?
1. Update `ORG_DOMAIN` in `.env`
2. Check DNS records point to server
3. Restart application

### Colors not changing?
1. Use valid hex codes (#rrggbb)
2. Check CSS file for hardcoded colors
3. Clear CSS cache

## Security Checklist

- [ ] Changed default admin password
- [ ] Set strong SESSION_SECRET
- [ ] Configured email provider credentials
- [ ] Updated organization information
- [ ] Tested contact form
- [ ] Tested admin login
- [ ] Updated footer content
- [ ] Verified domain configuration
- [ ] Set up backups
- [ ] Generated VAPID keys (if using push)

## Getting Help

- **Setup issues?** See `docs/ORGANIZATION_SETUP.md`
- **Deployment?** See `docs/DEPLOY_GUIDE.md`
- **Technical details?** See `docs/documentation.md`
- **Multiple organizations?** See `docs/MULTI_ORGANIZATION_GUIDE.md`

## Example: Full Setup

```bash
# 1. Clone and install
git clone [repository]
cd ChiroSite
npm install

# 2. Interactive setup
node scripts/setup-organization.js
# Follow prompts, enter your organization details

# 3. Add email credentials
# Edit .env and uncomment/fill ONE email provider

# 4. Start app
node server.js

# 5. Login and configure
# Browser: http://localhost:3000/admin
# Username: leiding
# Password: chiro
# → Change password
# → Update home page content
# → Add leaders/events
# → Customize as needed

# 6. Deploy to production
# See docs/DEPLOY_GUIDE.md
```

---

**For detailed documentation, see:**
- `docs/ORGANIZATION_SETUP.md` - Complete setup guide
- `docs/MULTI_ORGANIZATION_GUIDE.md` - Multi-organization support
- `.env.example` - All available variables
