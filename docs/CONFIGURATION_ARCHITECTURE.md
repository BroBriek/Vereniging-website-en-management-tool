# Configuration System Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration Sources                         │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │  Environment     │
    │  Variables       │
    │  (.env file or   │
    │   system vars)   │
    └────────┬─────────┘
             │ (Highest Priority)
             │
             ▼
    ┌─────────────────────────────────────────┐
    │     config/organization.js              │
    │                                         │
    │  Reads from:                           │
    │  1. Environment variables              │
    │  2. Hardcoded defaults                │
    │  3. Built-in application defaults     │
    └────────┬────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │    Organization Config Object           │
    │                                         │
    │  {                                      │
    │    organization: {...},                │
    │    web: {...},                         │
    │    contact: {...},                     │
    │    seo: {...},                         │
    │    branding: {...},                    │
    │    features: {...},                    │
    │    legal: {...}                        │
    │  }                                      │
    └────────┬────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │   Controllers & Views                    │
    │   (Use orgConfig for dynamic content)   │
    │                                         │
    │   app.locals.orgConfig = orgConfig      │
    │   res.locals.config = orgConfig         │
    └────────┬────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │   Frontend Output                        │
    │                                         │
    │   - Organization name in header         │
    │   - Contact info in footer              │
    │   - Meta tags for SEO                   │
    │   - Colors throughout site              │
    │   - Feature toggles                     │
    │   - Email sender information            │
    └─────────────────────────────────────────┘
```

## Setup Process

```
┌─────────────────────────────────────────────────────────────┐
│  User runs: node scripts/setup-organization.js              │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  Interactive Prompt for Each      │
        │  Configuration Section            │
        │                                   │
        │  1. Organization Information      │
        │  2. Web Configuration             │
        │  3. Contact Information           │
        │  4. SEO Information               │
        │  5. Branding Colors               │
        │  6. Legal Information             │
        │  7. General Settings              │
        └────────────┬──────────────────────┘
                     │
                     ▼
        ┌───────────────────────────────────┐
        │  Display Configuration Summary     │
        │  Ask for confirmation             │
        └────────────┬──────────────────────┘
                     │
                     ▼
        ┌───────────────────────────────────┐
        │  Write .env file with all         │
        │  configuration values             │
        └────────────┬──────────────────────┘
                     │
                     ▼
        ┌───────────────────────────────────┐
        │  ✓ Setup Complete                 │
        │  Next: node server.js             │
        └───────────────────────────────────┘
```

## Configuration Sections

```
┌────────────────────────────────────────────────────────────┐
│                   Organization Configuration                │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ORGANIZATION INFORMATION                                  │
│  ├─ name               (Basic organization name)           │
│  ├─ fullName           (Name with city)                    │
│  ├─ shortName          (For navbar)                        │
│  ├─ city               (City name)                         │
│  ├─ region             (Province/region)                   │
│  ├─ postalCode         (ZIP code)                          │
│  └─ address            (Street address)                    │
│                                                             │
│  WEB CONFIGURATION                                         │
│  ├─ domain             (Without www)                       │
│  ├─ domainWww          (With www)                          │
│  └─ baseUrl            (Full URL with protocol)            │
│                                                             │
│  CONTACT INFORMATION                                       │
│  ├─ email              (Main contact email)                │
│  ├─ noreplyEmail       (For automated messages)            │
│  ├─ emailName          (Email display name)                │
│  └─ facebook           (Facebook page name)                │
│                                                             │
│  SEO & META INFORMATION                                    │
│  ├─ keywords           (Meta keywords)                     │
│  ├─ defaultDescription (Default meta description)          │
│  └─ tagline            (Organization slogan)               │
│                                                             │
│  BRANDING                                                  │
│  ├─ primaryColor       (Main color)                        │
│  ├─ secondaryColor     (Accent color)                      │
│  ├─ backgroundColor    (PWA background)                    │
│  └─ themeColor         (Browser UI color)                  │
│                                                             │
│  FEATURES                                                  │
│  ├─ enableNewsletter   (Newsletter signups)                │
│  ├─ enableMerchandise  (Merchandise page)                  │
│  ├─ enableCalendar     (Event calendar)                    │
│  ├─ enableRegistrations (Member signups)                   │
│  └─ enableFinance      (Finance tracking)                  │
│                                                             │
│  LEGAL INFORMATION                                         │
│  ├─ foundingYear       (Year established)                  │
│  ├─ legalName          (Legal entity name)                 │
│  └─ vatNumber          (VAT ID, optional)                  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## How Settings Are Used

```
┌────────────────────────────────────────────────────────────┐
│                 APPLICATION USAGE AREAS                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  FRONTEND RENDERING                                        │
│  └─ Views (*.ejs files) read from res.locals.config       │
│     ├─ Header: Organization name, contact info            │
│     ├─ Footer: Address, email, copyright                  │
│     ├─ Meta tags: SEO titles, descriptions                │
│     ├─ Colors: Throughout CSS via CSS variables           │
│     └─ Navigation: Based on feature flags                 │
│                                                             │
│  SERVER-SIDE LOGIC                                        │
│  └─ Controllers use config for:                           │
│     ├─ Email configuration (from name, reply-to)          │
│     ├─ URL generation (base URLs)                         │
│     ├─ Domain validation                                  │
│     ├─ PDF generation (organization name)                 │
│     └─ Redirects (domain enforcement)                     │
│                                                             │
│  ADMIN INTERFACE                                           │
│  └─ Admin panel for:                                      │
│     ├─ Viewing current settings                           │
│     ├─ Updating settings (runtime)                        │
│     ├─ Color picker                                       │
│     └─ Feature flag management                            │
│                                                             │
│  PWA CONFIGURATION                                         │
│  └─ App manifest (manifest.json) uses:                    │
│     ├─ Organization name                                  │
│     ├─ Theme color                                        │
│     ├─ Background color                                   │
│     └─ Short name                                         │
│                                                             │
│  EMAIL COMMUNICATIONS                                      │
│  └─ Emails sent by:                                       │
│     ├─ From: email name (ORG_EMAIL_NAME)                  │
│     ├─ Reply-to: contact email                            │
│     ├─ Links using: base URL                              │
│     └─ Branding: organization name                        │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## File Structure

```
ChiroSite/
├── config/
│   ├── organization.js          ← Configuration module
│   ├── database.js
│   ├── mailer.js
│   └── passport.js
│
├── scripts/
│   ├── setup-organization.js    ← Interactive setup tool
│   └── [other scripts]
│
├── controllers/
│   ├── organizationController.js ← Admin settings
│   └── [other controllers]
│
├── views/
│   ├── admin/
│   │   └── organization-settings.ejs ← Admin UI
│   └── [other views]
│
├── docs/
│   ├── ORGANIZATION_SETUP.md     ← Detailed guide
│   ├── MULTI_ORGANIZATION_GUIDE.md ← Advanced guide
│   └── [other docs]
│
├── .env                          ← Configuration file (in .gitignore)
├── .env.example                  ← Configuration template
├── QUICK_REFERENCE.md            ← Quick reference
├── IMPLEMENTATION_SUMMARY.md     ← Implementation details
├── CHANGELOG.md                  ← Change log
└── README.md                     ← Updated with setup info
```

## Environment Variable Processing

```
┌─ Set Variable in .env ─────┐
│  ORG_NAME=Chiro MyCity     │
└──────────┬──────────────────┘
           │
           ▼
┌─ Application Startup ──────────────────┐
│ require('dotenv').config()             │
│ process.env.ORG_NAME = 'Chiro MyCity'  │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─ config/organization.js ───────────────┐
│ name: process.env.ORG_NAME ||          │
│       'Chiro Vreugdeland'              │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─ Application Uses Value ───────────────┐
│ orgConfig.organization.name            │
│ = 'Chiro MyCity'                       │
└────────────────────────────────────────┘
```

## Multiple Organizations Flow

```
Organization A
├─ Run: node scripts/setup-organization.js
├─ Enter settings for Organization A
├─ Generate .env with Organization A config
└─ Start server: node server.js
   → Site displays Organization A branding

Organization B
├─ Run: node scripts/setup-organization.js
├─ Enter settings for Organization B
├─ Generate .env with Organization B config
└─ Start server: node server.js
   → Site displays Organization B branding

(No code changes needed between organizations)
```

## Configuration Priority

```
┌─────────────────────────────────────────┐
│  Priority 1: Environment Variables      │
│  (Highest Priority)                     │
│  process.env.ORG_NAME                   │
│  ✓ From .env file                       │
│  ✓ From system environment              │
│  ✓ From hosting provider                │
└─────────────┬───────────────────────────┘
              │
              ├──► Use Environment Value
              │
              ▼ (if not set)
┌─────────────────────────────────────────┐
│  Priority 2: Hardcoded Defaults         │
│  in config/organization.js              │
│  'Chiro Vreugdeland' (example)          │
└─────────────┬───────────────────────────┘
              │
              ├──► Use Default Value
              │
              ▼ (if not set)
┌─────────────────────────────────────────┐
│  Priority 3: Built-in Defaults          │
│  (Lowest Priority)                      │
│  Hardcoded in database, models, etc.    │
└─────────────────────────────────────────┘
```

---

**Environment variables always take precedence over hardcoded defaults.**
This allows for flexible deployment while maintaining sensible defaults.
