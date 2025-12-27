# User Journey: Setting Up Your Chiro Site

This document walks through typical user journeys for setting up and customizing the Chiro Site.

## Journey 1: First-Time Setup (Recommended)

### User: New Organization Admin
**Goal:** Get a Chiro website up and running in 15 minutes
**Skill Level:** Non-technical

```
Start
  │
  ├─► Clone repository
  │   └─► cd ChiroSite
  │
  ├─► Install dependencies
  │   └─► npm install
  │       ⏱️  Takes 1-2 minutes
  │
  ├─► Run setup tool
  │   └─► node scripts/setup-organization.js
  │       ⏱️  Takes 5-10 minutes
  │
  │   Setup Tool:
  │   ├─► Ask: What's your organization name?
  │   │   User: "Chiro Amsterdam"
  │   │
  │   ├─► Ask: Full name with city?
  │   │   User: "Chiro Amsterdam West"
  │   │
  │   ├─► Ask: Your website domain?
  │   │   User: "chiro-amsterdam.nl"
  │   │
  │   ├─► Ask: Contact email?
  │   │   User: "contact@chiro-amsterdam.nl"
  │   │
  │   ├─► Ask: Brand colors? (optional)
  │   │   User: (press Enter to use defaults)
  │   │
  │   ├─► Ask: Confirm settings?
  │   │   User: "yes"
  │   │
  │   └─► ✓ Created .env file
  │
  ├─► Start application
  │   └─► node server.js
  │
  ├─► Open in browser
  │   └─► http://localhost:3000
  │       ⏱️  Website is live!
  │
  ├─► Log in to admin
  │   └─► http://localhost:3000/admin
  │       Username: leiding
  │       Password: chiro
  │
  ├─► Change admin password
  │   └─► Go to Settings
  │       Change password immediately
  │       ✓ Security best practice
  │
  ├─► Customize homepage
  │   └─► Go to Page Editor
  │       Edit hero title, tagline
  │       Update introduction
  │       ✓ Save
  │
  ├─► Add leadership team
  │   └─► Go to Leaders
  │       Add team members
  │       Upload photos
  │       ✓ Save
  │
  ├─► Add events to calendar
  │   └─► Go to Events
  │       Create calendar entries
  │       Set dates and times
  │       ✓ Save
  │
  └─► Done!
      Organization website is ready to share

```

**Time Estimate:** 20-30 minutes total
**Technical Knowledge Required:** Minimal

---

## Journey 2: Manual Setup

### User: Developer or Technical Admin
**Goal:** Custom configuration with full control
**Skill Level:** Technical

```
Start
  │
  ├─► Clone repository
  │
  ├─► Install dependencies
  │   └─► npm install
  │
  ├─► Copy configuration template
  │   └─► cp .env.example .env
  │
  ├─► Open .env in text editor
  │   └─► Edit each variable
  │
  │   Manual Configuration:
  │   ├─► ORG_NAME=Chiro Amsterdam
  │   ├─► ORG_FULL_NAME=Chiro Amsterdam West
  │   ├─► ORG_DOMAIN=chiro-amsterdam.nl
  │   ├─► ORG_EMAIL=contact@chiro-amsterdam.nl
  │   ├─► ORG_PRIMARY_COLOR=#ff0000
  │   └─► ... (all other variables)
  │
  ├─► Configure email provider
  │   └─► Choose provider (Gmail, Outlook, etc.)
  │       Add credentials to .env
  │
  ├─► Start application
  │   └─► node server.js
  │
  ├─► Test configuration
  │   └─► Visit homepage
  │       Check header/footer
  │       Verify colors
  │       Test contact form
  │
  └─► Done!
      Ready for deployment

```

**Time Estimate:** 15-20 minutes
**Technical Knowledge Required:** Text editor, environment variables

---

## Journey 3: Updating Organization Settings

### User: Existing Admin
**Goal:** Change organization branding/information
**Skill Level:** Varies

### Option A: Admin Dashboard (Recommended)

```
Start
  │
  ├─► Log in to admin
  │   └─► /admin/organization-settings
  │
  ├─► View current settings
  │   └─► Review all organization information
  │
  ├─► Update fields as needed
  │   ├─► Change organization name
  │   ├─► Update contact email
  │   ├─► Pick new colors with color picker
  │   └─► Edit SEO keywords
  │
  ├─► Click "Save Organization Settings"
  │   └─► ✓ Changes apply immediately
  │
  ├─► Test changes
  │   └─► Refresh website
  │       Verify updates are visible
  │
  ├─► Update .env file
  │   └─► Copy new values from admin panel
  │       Paste into .env file
  │       Save file
  │       Restart application for persistence
  │
  └─► Done!
      Organization information is updated

```

### Option B: Manual .env Edit

```
Start
  │
  ├─► Open .env file
  │
  ├─► Find variable to change
  │   └─► e.g., ORG_NAME=
  │
  ├─► Update value
  │   └─► ORG_NAME=Chiro New City
  │
  ├─► Save file
  │
  ├─► Restart application
  │   └─► Stop: Ctrl+C
  │       Start: node server.js
  │
  ├─► Verify changes
  │   └─► Refresh website
  │       Confirm updates visible
  │
  └─► Done!
      Configuration updated

```

---

## Journey 4: Color Customization

### User: Designer or Brand Manager
**Goal:** Match organization brand colors
**Skill Level:** Non-technical

```
Start
  │
  ├─► Log in to admin
  │   └─► /admin/organization-settings
  │
  ├─► Scroll to "Branding Colors" section
  │
  ├─► Click color picker for each color
  │   ├─► Primary Color (main brand color)
  │   │   └─► Select desired color
  │   │
  │   ├─► Secondary Color (accents)
  │   │   └─► Select desired color
  │   │
  │   ├─► Background Color
  │   │   └─► Select desired color
  │   │
  │   └─► Theme Color (browser UI)
  │       └─► Select desired color
  │
  ├─► See preview instantly
  │   └─► Colors update in form
  │       Hex codes displayed
  │
  ├─► Save settings
  │   └─► Click "Save Organization Settings"
  │
  ├─► View website
  │   └─► Open new browser tab
  │       /
  │       Colors should update
  │       (May need refresh)
  │
  ├─► Adjust if needed
  │   └─► Go back to settings
  │       Try different colors
  │       Compare with brand guide
  │
  └─► Done!
      Brand colors are applied

```

**Time Estimate:** 10 minutes
**Technical Knowledge Required:** None

---

## Journey 5: Multi-Organization Setup

### User: Organization Manager or Hosting Provider
**Goal:** Deploy site for multiple Chiro organizations
**Skill Level:** Technical

```
Organization 1: Chiro Amsterdam
  │
  ├─► Create directory
  │   └─► mkdir chiro-amsterdam
  │
  ├─► Clone code
  │   └─► cd chiro-amsterdam
  │       git clone [repository]
  │
  ├─► Run setup
  │   └─► npm install
  │       node scripts/setup-organization.js
  │       Enter: Chiro Amsterdam details
  │
  ├─► Start server
  │   └─► node server.js
  │       Port: 3000
  │
  └─► ✓ Chiro Amsterdam site running

Organization 2: Chiro Rotterdam
  │
  ├─► Create directory
  │   └─► mkdir chiro-rotterdam
  │
  ├─► Clone code
  │   └─► cd chiro-rotterdam
  │       git clone [repository]
  │
  ├─► Run setup
  │   └─► npm install
  │       node scripts/setup-organization.js
  │       Enter: Chiro Rotterdam details
  │
  ├─► Start server
  │   └─► node server.js
  │       Port: 3001
  │
  └─► ✓ Chiro Rotterdam site running

Key Insight:
├─► Same code base used
├─► Different .env files
├─► Different organizations
└─► Zero code modifications needed

```

**Time per Organization:** ~15 minutes
**Total Setup Time:** 30 minutes for 2 organizations

---

## Journey 6: Feature Configuration

### User: Admin Customizing Features
**Goal:** Enable/disable specific features
**Skill Level:** Basic

```
Start
  │
  ├─► Edit .env file
  │
  ├─► Find "FEATURE FLAGS" section
  │   └─► # Enable or disable specific features
  │
  ├─► Toggle features
  │   ├─► Newsletter signup
  │   │   ENABLE_NEWSLETTER=true/false
  │   │
  │   ├─► Merchandise (T-shirts)
  │   │   ENABLE_MERCHANDISE=true/false
  │   │
  │   ├─► Event calendar
  │   │   ENABLE_CALENDAR=true/false
  │   │
  │   ├─► Member registration
  │   │   ENABLE_REGISTRATIONS=true/false
  │   │
  │   └─► Finance tracking
  │       ENABLE_FINANCE=true/false
  │
  ├─► Example configuration
  │   ├─► Small organization
  │   │   ├─► ENABLE_NEWSLETTER=false
  │   │   ├─► ENABLE_MERCHANDISE=false
  │   │   ├─► ENABLE_CALENDAR=true
  │   │   └─► ENABLE_REGISTRATIONS=true
  │   │
  │   └─► Large organization
  │       ├─► ENABLE_NEWSLETTER=true
  │       ├─► ENABLE_MERCHANDISE=true
  │       ├─► ENABLE_CALENDAR=true
  │       └─► All enabled
  │
  ├─► Save changes
  │   └─► Ctrl+S
  │
  ├─► Restart application
  │   └─► Features appear/disappear
  │       from navigation menu
  │
  └─► Done!
      Features customized

```

---

## Journey 7: Deployment to Production

### User: DevOps or System Admin
**Goal:** Deploy site to production server
**Skill Level:** Advanced

```
Local Machine:
  ├─► Run setup tool
  │   └─► node scripts/setup-organization.js
  │
  ├─► Generate .env file
  │   └─► Contains all configuration
  │
  └─► Prepare for deployment

Production Server:
  │
  ├─► Clone code repository
  │   └─► git clone [repository]
  │       cd ChiroSite
  │
  ├─► Install dependencies
  │   └─► npm install
  │
  ├─► Set environment variables
  │   ├─► Option A: Via .env file
  │   │   └─► Copy .env from setup
  │   │
  │   ├─► Option B: Hosting provider
  │   │   └─► Heroku: Config Vars
  │   │       Railway: Environment Variables
  │   │       AWS: Parameter Store
  │   │
  │   └─► Option C: System environment
  │       └─► export ORG_NAME="..."
  │           export ORG_EMAIL="..."
  │
  ├─► Set critical variables
  │   ├─► SESSION_SECRET (strong random string)
  │   ├─► NODE_ENV=production
  │   ├─► ORG_DOMAIN (matching your domain)
  │   ├─► Email provider credentials
  │   └─► DATABASE configuration (if not SQLite)
  │
  ├─► Start application
  │   └─► node server.js
  │       Or use PM2: pm2 start server.js
  │
  ├─► Configure reverse proxy (optional)
  │   ├─► nginx or Apache
  │   └─► Route www.domain.com → localhost:3000
  │
  ├─► Enable HTTPS (required)
  │   └─► Let's Encrypt or other certificate
  │
  ├─► Set up backups
  │   └─► Database backups (if using file-based DB)
  │       User uploaded files backup
  │
  ├─► Configure monitoring
  │   └─► Error tracking
  │       Performance monitoring
  │       Uptime alerts
  │
  └─► Done!
      Production site is live

```

---

## Journey 8: Migrating Between Organizations

### User: DevOps managing multiple instances
**Goal:** Change an instance from one organization to another
**Skill Level:** Advanced

```
Old Organization:
  ├─► Backup database and files
  │   └─► Important: Don't lose data!
  │
  └─► ✓ Backed up

New Organization:
  │
  ├─► Update environment variables
  │   ├─► Run: node scripts/setup-organization.js
  │   └─► Or manually edit .env
  │       ORG_NAME=New Organization
  │       ORG_EMAIL=newemail@...
  │       ORG_DOMAIN=newdomain.com
  │       etc.
  │
  ├─► Optional: Reset database
  │   ├─► npm run reset-database
  │   └─► Or keep existing data
  │       (users, events, etc. are
  │        organization-agnostic)
  │
  ├─► Restart application
  │   └─► node server.js
  │
  ├─► Verify
  │   ├─► Check header/footer
  │   ├─► Verify contact email
  │   ├─► Test admin login
  │   └─► Check colors
  │
  └─► Done!
      Instance now serves new organization

Key Benefit:
  └─► No code changes needed
      Just configuration updates
      Database can be shared or separate
      Completely isolated branding

```

---

## Common Decision Trees

### "I want to customize [X]"

```
┌─ Organization Name
│  └─► Edit .env: ORG_NAME, ORG_FULL_NAME, ORG_SHORT_NAME
│      Or use admin panel: /admin/organization-settings
│      Restart application
│
├─ Colors
│  └─► Option A: Admin panel with color picker (easiest)
│      Option B: Edit .env: ORG_PRIMARY_COLOR, etc.
│      Restart application for persistence
│
├─ Contact Information
│  └─► Edit .env: ORG_EMAIL, ORG_NOREPLY_EMAIL
│      Also update footer via admin Page Editor
│      Restart application
│
├─ Homepage Content
│  └─► Admin panel: /admin/page/home
│      Edit hero title, tagline, introduction
│      No restart needed
│
├─ Leadership Team
│  └─► Admin panel: /admin/leaders
│      Add/edit team members
│      No restart needed
│
├─ Enable/Disable Features
│  └─► Edit .env: ENABLE_* variables
│      Restart application
│
├─ Email Configuration
│  └─► Edit .env: Add one email provider section
│      Uncomment and fill in credentials
│      Restart application
│      Test with contact form
│
└─ SEO Keywords/Description
   └─► Edit .env: ORG_KEYWORDS, ORG_DEFAULT_DESC
       Or admin panel
       Affects meta tags on all pages
```

---

## Time Estimates

| Task | Time | Difficulty |
|------|------|------------|
| Initial Setup (interactive) | 15-20 min | Easy |
| Manual Setup | 20-30 min | Medium |
| Change Organization Name | 2-5 min | Easy |
| Customize Colors | 5-10 min | Easy |
| Update Email Configuration | 10-15 min | Medium |
| Add Leadership Team | 10-20 min | Easy |
| Add Calendar Events | 10 min per event | Easy |
| Edit Homepage Content | 10-20 min | Easy |
| Deploy to Production | 30-60 min | Hard |
| Migrate to New Organization | 10-15 min | Medium |

---

## Success Indicators

✅ **Setup is Complete When:**
- [ ] Website loads on localhost:3000
- [ ] Header shows your organization name
- [ ] Footer shows your address and email
- [ ] Colors match your brand (or acceptable defaults)
- [ ] Admin login works
- [ ] Can edit homepage content
- [ ] Can add leadership team members
- [ ] Contact form sends emails

✅ **Production is Ready When:**
- [ ] Domain name resolves to your site
- [ ] HTTPS is working
- [ ] Admin can log in from anywhere
- [ ] Emails are being sent correctly
- [ ] Database backups are automated
- [ ] Error tracking is configured
- [ ] Monitoring is in place
- [ ] Users can register (if enabled)

---

**Each journey should take 15-30 minutes depending on complexity and technical knowledge.**
