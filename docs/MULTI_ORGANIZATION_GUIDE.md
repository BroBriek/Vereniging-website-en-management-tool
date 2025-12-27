# Chiro Site - Multi-Organization Customization Guide

This Chiro Site application has been enhanced to support multiple Chiro organizations with minimal code changes. All organization-specific content is now configurable through environment variables and the admin interface.

## Overview

The application now uses a centralized configuration system that allows you to customize:

- **Organization Information** - Name, address, contact details
- **Web Settings** - Domain, base URL, email addresses
- **Branding** - Colors, logos, appearance
- **SEO** - Keywords, descriptions, meta tags
- **Legal** - Organization name for documents, VAT number
- **Features** - Enable/disable specific functionality

## Quick Setup

### Option 1: Interactive Setup Tool (Recommended)

```bash
node scripts/setup-organization.js
```

This guided tool walks you through all customization options and generates your `.env` file.

### Option 2: Manual Configuration

Edit your `.env` file with organization-specific variables. See `docs/ORGANIZATION_SETUP.md` for a complete list.

### Option 3: Admin Dashboard

After setup, customize additional settings via:
- Admin Dashboard → Organization Settings (`/admin/organization-settings`)
- Page Content Editor → Customize home page, sections, etc.
- Leaders Management → Add your leadership team
- Events Manager → Add calendar events
- Finance Tools → Configure finance tracking

## Key Features

### 1. Automatic Configuration

All views automatically use your organization settings:
- **Header/Footer** - Organization name and contact info
- **Meta Tags** - SEO-optimized titles and descriptions
- **Colors** - Brand colors throughout the site
- **Email Branding** - Automated emails use your organization name

### 2. No Code Changes Required

To adapt this site for a different Chiro organization:

1. Run the setup script
2. Enter your organization details
3. Done! The site is ready to use

### 3. Customizable Features

Enable or disable features in your `.env` file:

```env
ENABLE_NEWSLETTER=true        # Newsletter signups
ENABLE_MERCHANDISE=true       # T-shirt/merchandise selling
ENABLE_CALENDAR=true          # Event calendar
ENABLE_REGISTRATIONS=true     # Member registrations
ENABLE_FINANCE=true           # Finance tracking
```

## Configuration System

### File Locations

- **Configuration Module**: `config/organization.js`
- **Setup Script**: `scripts/setup-organization.js`
- **Environment Variables**: `.env` file
- **Documentation**: `docs/ORGANIZATION_SETUP.md`

### Configuration Hierarchy

Settings are loaded in this order (first match wins):

1. Environment variables (`.env` file or system)
2. Hardcoded defaults in `config/organization.js`
3. Application defaults

## Customization Areas

### 1. Organization Information

Located in `config/organization.js` → `organization` section

```javascript
{
  name: 'Chiro Vreugdeland',
  fullName: 'Chiro Vreugdeland Meeuwen',
  shortName: 'CHIRO VREUGDELAND',
  city: 'Meeuwen',
  region: 'Limburg',
  postalCode: '3670',
  address: 'Kloosterstraat 5'
}
```

**Set via environment:**
```env
ORG_NAME=Your Organization Name
ORG_FULL_NAME=Your Organization City
ORG_SHORT_NAME=ABBREVIATED NAME
ORG_CITY=Your City
ORG_REGION=Your Region
ORG_POSTAL_CODE=1234
ORG_ADDRESS=Your Street 5
```

### 2. Web Configuration

Controls domains and URLs used throughout the site.

**Set via environment:**
```env
ORG_DOMAIN=example.be
ORG_DOMAIN_WWW=www.example.be
ORG_BASE_URL=https://www.example.be
```

Used in:
- Domain redirection (`server.js`)
- Email links (notification service)
- Social media URLs (meta tags)
- Sitemaps and robots.txt

### 3. Contact Information

Email addresses and social media channels.

**Set via environment:**
```env
ORG_EMAIL=contact@example.be
ORG_NOREPLY_EMAIL=noreply@example.be
ORG_EMAIL_NAME=Your Organization Name
ORG_FACEBOOK=YourFacebookPage
```

Used in:
- Contact form responses
- Email notifications
- Footer contact section
- Social media links

### 4. SEO & Meta Information

Search engine optimization settings.

**Set via environment:**
```env
ORG_KEYWORDS=keyword1, keyword2, keyword3
ORG_DEFAULT_DESC=Your organization description (160 chars)
ORG_TAGLINE=Your catchy slogan
```

Used in:
- Meta tags (OpenGraph, Twitter, Schema.org)
- Page titles
- Search engine descriptions
- Social media sharing previews

### 5. Branding Colors

Customize the visual appearance.

**Set via environment:**
```env
ORG_PRIMARY_COLOR=#db3e41      # Main color (Chiro red)
ORG_SECONDARY_COLOR=#ffd800    # Accent color (Chiro yellow)
ORG_BG_COLOR=#fdfbf7          # Background
ORG_THEME_COLOR=#db3e41       # Browser UI theme
```

Used in:
- CSS variables (easy customization)
- PWA manifest
- Browser tab color
- Button and accent elements

### 6. Legal Information

For compliance and legal documents.

**Set via environment:**
```env
ORG_LEGAL_NAME=Your Legal Entity Name
ORG_FOUNDING_YEAR=2024
ORG_VAT_NUMBER=BE1234567890  # Optional
```

Used in:
- Privacy notices
- Legal documents
- Copyright statements
- Business registration

### 7. Feature Toggles

Enable or disable features per organization.

**Set via environment:**
```env
ENABLE_NEWSLETTER=true
ENABLE_MERCHANDISE=true
ENABLE_CALENDAR=true
ENABLE_REGISTRATIONS=true
ENABLE_FINANCE=true
```

Used in:
- Route availability
- Navigation menu
- Admin dashboard
- Feature-specific pages

## Files Modified for Multi-Organization Support

The following files have been created or updated to support customization:

### New Files:
- `config/organization.js` - Central configuration module
- `scripts/setup-organization.js` - Interactive setup tool
- `controllers/organizationController.js` - Admin settings controller
- `views/admin/organization-settings.ejs` - Admin settings UI
- `docs/ORGANIZATION_SETUP.md` - Detailed setup documentation

### Updated Files:
- `.env.example` - Added all organization variables
- `README.md` - Updated installation instructions
- `server.js` - Uses organization config for domain checking
- Views & Controllers - Reference `orgConfig` for dynamic content

## Usage Examples

### Example 1: Setup for Chiro Amsterdam

```bash
node scripts/setup-organization.js
```

When prompted, enter:
- Name: `Chiro Amsterdam`
- Full Name: `Chiro Amsterdam West`
- Short Name: `CHIRO AMSTERDAM`
- City: `Amsterdam`
- Domain: `chiro-amsterdam.nl`
- Email: `contact@chiro-amsterdam.nl`
- etc.

### Example 2: Change Colors to Match New Branding

Edit `.env`:
```env
ORG_PRIMARY_COLOR=#ff0000
ORG_SECONDARY_COLOR=#00ff00
ORG_BG_COLOR=#ffffff
```

Restart the application.

### Example 3: Disable Merchandise Feature

```env
ENABLE_MERCHANDISE=false
```

The merchandise page and navigation link will no longer appear.

## Admin Dashboard Features

### Organization Settings Panel
- **Location**: `/admin/organization-settings`
- **Purpose**: View and update all organization settings
- **Note**: Changes apply immediately but need `.env` update for persistence

### Page Content Management
- Customize home page content
- Edit other pages (praktisch, afdelingen, etc.)
- Add custom HTML/rich text

### Leaders Management
- Add and manage leadership team
- Upload profile photos
- Organize by role/section

### Events Calendar
- Create and manage events
- Set dates, times, and descriptions
- Calendar appears on public site

### Finance Tools
- Track income and expenses
- Generate financial reports
- Export to Excel

## Environment Variables Reference

Complete list of all available environment variables:

```env
# Organization Information
ORG_NAME=
ORG_FULL_NAME=
ORG_SHORT_NAME=
ORG_CITY=
ORG_REGION=
ORG_POSTAL_CODE=
ORG_ADDRESS=

# Web Configuration
ORG_DOMAIN=
ORG_DOMAIN_WWW=
ORG_BASE_URL=

# Contact
ORG_EMAIL=
ORG_NOREPLY_EMAIL=
ORG_EMAIL_NAME=
ORG_FACEBOOK=

# SEO
ORG_KEYWORDS=
ORG_DEFAULT_DESC=
ORG_TAGLINE=

# Branding
ORG_PRIMARY_COLOR=
ORG_SECONDARY_COLOR=
ORG_BG_COLOR=
ORG_THEME_COLOR=

# Legal
ORG_LEGAL_NAME=
ORG_FOUNDING_YEAR=
ORG_VAT_NUMBER=

# Features
ENABLE_NEWSLETTER=
ENABLE_MERCHANDISE=
ENABLE_CALENDAR=
ENABLE_REGISTRATIONS=
ENABLE_FINANCE=

# General
SESSION_SECRET=
PORT=
NODE_ENV=
APP_URL=
```

## Best Practices

1. **Always use the setup script first**
   - Ensures all required variables are set
   - Guides you through best practices

2. **Change default admin credentials immediately**
   - Default: `leiding` / `chiro`
   - Go to `/account/settings` to change password

3. **Set strong SESSION_SECRET**
   - Critical for session security
   - Use at least 32 random characters

4. **Use environment variables in production**
   - Don't commit `.env` files to git
   - Use your hosting provider's environment settings

5. **Test changes locally first**
   - Verify all settings work correctly
   - Test all organization-specific features

6. **Keep domain configuration consistent**
   - Ensure `ORG_DOMAIN` and `ORG_DOMAIN_WWW` match your actual domain
   - Update domain redirects in `server.js` if needed

## Troubleshooting

### Settings not changing?
- Restart the application (`node server.js`)
- Clear browser cache
- Check `.env` file syntax

### Colors not updating?
- Use valid hex color codes (e.g., `#ff0000`)
- Some colors may be hardcoded in CSS
- See `public/css/style.css` for CSS variables

### Domain redirects not working?
- Update `ORG_DOMAIN` and `ORG_DOMAIN_WWW` in `.env`
- Ensure DNS records point to your server
- Clear browser cache

## Future Enhancements

Potential improvements for multi-organization support:

- [ ] Multi-database support (separate DB per organization)
- [ ] Custom theme/template selection
- [ ] Logo upload and management
- [ ] Custom domain per organization
- [ ] Bulk organization management tool
- [ ] Organization-specific feature pricing
- [ ] White-label deployment option

## Support & Documentation

For more information:
- Setup Guide: `docs/ORGANIZATION_SETUP.md`
- General Documentation: `docs/documentation.md`
- Deployment Guide: `docs/DEPLOY_GUIDE.md`
- Configuration Module: `config/organization.js`

## License

This multi-organization enhancement maintains the same license as the original project.
