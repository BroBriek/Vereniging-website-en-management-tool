# Organization Setup Guide

This guide explains how to customize the Chiro Site for your specific organization.

## Quick Start

The fastest way to set up your organization is to use the interactive setup tool:

```bash
node scripts/setup-organization.js
```

This script will guide you through all the customization options and generate a `.env` file with your settings.

## Manual Setup

If you prefer to set up manually, copy the following variables to your `.env` file:

### Organization Information

```env
# Your Chiro organization name
ORG_NAME=Chiro Vreugdeland

# Full name with city (used in titles and meta tags)
ORG_FULL_NAME=Chiro Vreugdeland Meeuwen

# Short name for navbar (usually "CHIRO [NAME]")
ORG_SHORT_NAME=CHIRO VREUGDELAND

# Location details
ORG_CITY=Meeuwen
ORG_REGION=Limburg
ORG_POSTAL_CODE=3670
ORG_ADDRESS=Kloosterstraat 5
```

### Web Configuration

```env
# Your domain (without www)
ORG_DOMAIN=chiromeeuwen.be

# Your domain with www
ORG_DOMAIN_WWW=www.chiromeeuwen.be

# Full URL with protocol
ORG_BASE_URL=https://www.chiromeeuwen.be
```

### Contact Information

```env
# Main contact email (shown in footer)
ORG_EMAIL=Chiromeeuwen@outlook.com

# Email for automated messages (registrations, notifications)
ORG_NOREPLY_EMAIL=noreply@chiromeeuwen.be

# Name shown in "From:" field of emails
ORG_EMAIL_NAME=Chiro Vreugdeland

# Facebook page name (without facebook.com/)
ORG_FACEBOOK=ChiroVreugdelandMeeuwen
```

### SEO & Meta Information

```env
# Meta keywords for search engines (comma-separated)
ORG_KEYWORDS=Chiro Meeuwen, Chiro Vreugdeland, jeugdbeweging, jeugdorganisatie, kinderen activiteiten, Meeuwen

# Default meta description (used on pages without custom description)
ORG_DEFAULT_DESC=Chiro Vreugdeland Meeuwen: jeugdbeweging voor kinderen in Meeuwen. Elke zondag spelen, activiteiten, vriendschap en plezier.

# Tagline/slogan (displayed on homepage)
ORG_TAGLINE=Elke zondag staan we klaar met een bende enthousiaste leiding om jullie kinderen de tijd van hun leven te bezorgen.
```

### Branding Colors

```env
# Primary color (used for buttons, highlights) - Default: Chiro red
ORG_PRIMARY_COLOR=#db3e41

# Secondary color (used for accents) - Default: Chiro yellow
ORG_SECONDARY_COLOR=#ffd800

# Background color (for PWA)
ORG_BG_COLOR=#fdfbf7

# Theme color (for browser UI chrome)
ORG_THEME_COLOR=#db3e41
```

### Legal Information

```env
# Legal entity name (for privacy notices, legal documents)
ORG_LEGAL_NAME=Chiro Vreugdeland Meeuwen

# Year organization was founded
ORG_FOUNDING_YEAR=2024

# VAT number (if applicable)
ORG_VAT_NUMBER=
```

## Where Are These Settings Used?

Once configured, these settings automatically customize:

### Frontend
- **Header/Navbar** - Organization name and branding
- **Footer** - Address, contact email, copyright
- **Meta Tags** - Page titles, descriptions (for SEO)
- **Social Media Preview** - Open Graph tags for sharing
- **Colors** - Primary and secondary colors throughout the site

### Backend
- **Email Configuration** - From name and noreply addresses
- **URL Generation** - Base URLs for email links and notifications
- **Admin Dashboard** - Organization name in documents and exports

### PWA (Progressive Web App)
- **App Name** - Shown when installed on devices
- **Icon Colors** - Theme and background colors
- **Manifest** - App configuration

## Admin Settings Panel

You can also manage these settings through the admin dashboard:

1. Log in to `/admin`
2. Navigate to **Admin Settings** → **Organization Settings**
3. Update any fields you want to change
4. Click **Save Organization Settings**

After saving through the admin panel, remember to update your `.env` file to persist changes across application restarts.

## Configuration File

The application reads settings from `config/organization.js`:

```javascript
module.exports = {
  organization: {
    name: process.env.ORG_NAME || 'Chiro Vreugdeland',
    fullName: process.env.ORG_FULL_NAME || 'Chiro Vreugdeland Meeuwen',
    // ... more settings
  },
  // ... more sections
};
```

You can also directly edit this file if needed, but environment variables take precedence.

## Customizing Content Beyond Settings

While these settings customize organization-specific information, you can also customize content through:

### Home Page
- Log in as admin
- Go to `/admin/page/home`
- Edit hero title, hero text, and introduction

### Other Pages
- Edit any page by going to `/admin/page/{slug}`
- Available slugs: `praktisch`, `afdelingen`, `contact`, etc.

### Team/Leaders
- Add and manage leadership team members in `/admin/leaders`
- This appears on the public leaders page (`/leiding`)

### Events & Calendar
- Manage events in `/admin/events`
- Events appear on the calendar page (`/kalender`)

## Environment Variables Precedence

Settings are determined in this order:
1. **Environment variables** (from `.env` file or system)
2. **Hardcoded defaults** (in `config/organization.js`)

Environment variables always override defaults, so they take highest priority.

## Example: Changing Your Organization Name

To change your organization from "Chiro Vreugdeland" to "Chiro MyCity":

1. **Using the setup script:**
   ```bash
   node scripts/setup-organization.js
   ```
   Then enter "Chiro MyCity" when prompted

2. **Or manually edit `.env`:**
   ```env
   ORG_NAME=Chiro MyCity
   ORG_FULL_NAME=Chiro MyCity Amsterdam
   ORG_SHORT_NAME=CHIRO MYCITY
   ```

3. **Then restart the application:**
   ```bash
   node server.js
   ```

## Troubleshooting

### Changes not taking effect?
- Make sure you've restarted the application (`node server.js`)
- Clear your browser cache
- Check that environment variables are properly set in your `.env` file

### Can't find admin settings?
- Make sure you're logged in as an admin user
- Default credentials are: username `leiding`, password `chiro` (you should change these immediately!)

### Colors not changing?
- Color values must be valid hex codes (e.g., `#ff0000`)
- Some colors are hardcoded in CSS - see `public/css/style.css`
- CSS variables are defined at the top of the stylesheet

## Best Practices

1. **Change default admin credentials** immediately:
   - Log in with `leiding / chiro`
   - Go to `/account/settings` and change your password

2. **Set a strong SESSION_SECRET**:
   - This is critical for security
   - Use a random, long string (at least 32 characters)

3. **Use environment variables in production**:
   - Don't rely on `.env` files in production
   - Set environment variables through your hosting provider
   - This keeps sensitive information secure

4. **Keep a backup of your configuration**:
   - Save your `.env` file in a secure location
   - Document any customizations you've made

5. **Test changes locally first**:
   - Test all branding changes on localhost before deploying
   - Verify all contact information is correct

## Getting Help

For more information about the application structure, see:
- `README.md` - General setup instructions
- `docs/documentation.md` - Detailed feature documentation
- `docs/DEPLOY_GUIDE.md` - Production deployment guide
