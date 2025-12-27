#!/usr/bin/env node

/**
 * Interactive Organization Setup Tool
 * 
 * This script helps you configure the application for your Chiro organization.
 * It will guide you through customizing organization-specific details and generate
 * or update your .env file with the necessary environment variables.
 * 
 * Usage: node scripts/setup-organization.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`ℹ ${msg}`),
};

// Template for .env file
const envTemplate = (config) => `# ==================== ORGANIZATION CONFIGURATION ====================
# Customize these values for your Chiro organization

ORG_NAME=${config.orgName}
ORG_FULL_NAME=${config.orgFullName}
ORG_SHORT_NAME=${config.orgShortName}
ORG_CITY=${config.orgCity}
ORG_REGION=${config.orgRegion}
ORG_POSTAL_CODE=${config.orgPostalCode}
ORG_ADDRESS=${config.orgAddress}

# Web Configuration
ORG_DOMAIN=${config.orgDomain}
ORG_DOMAIN_WWW=${config.orgDomainWww}
ORG_BASE_URL=${config.orgBaseUrl}

# Contact Information
ORG_EMAIL=${config.orgEmail}
ORG_NOREPLY_EMAIL=${config.orgNoreplyEmail}
ORG_EMAIL_NAME=${config.orgEmailName}
ORG_FACEBOOK=${config.orgFacebook}

# SEO & Meta Tags
ORG_KEYWORDS=${config.orgKeywords}
ORG_DEFAULT_DESC=${config.orgDefaultDesc}
ORG_TAGLINE=${config.orgTagline}

# Branding Colors (hex codes)
ORG_PRIMARY_COLOR=${config.orgPrimaryColor}
ORG_SECONDARY_COLOR=${config.orgSecondaryColor}
ORG_BG_COLOR=${config.orgBgColor}
ORG_THEME_COLOR=${config.orgThemeColor}

# Legal Information
ORG_LEGAL_NAME=${config.orgLegalName}
ORG_FOUNDING_YEAR=${config.orgFoundingYear}
ORG_VAT_NUMBER=${config.orgVatNumber}

# ==================== GENERAL CONFIGURATION ====================
# Required for session security - CHANGE THIS TO A RANDOM STRONG STRING!
SESSION_SECRET=${config.sessionSecret}

# Application Port
PORT=${config.port}

# Node Environment
NODE_ENV=${config.nodeEnv}

# Application URL (for notifications, emails, etc.)
APP_URL=${config.appUrl}

# ==================== EMAIL CONFIGURATION ====================
# Email service credentials - Choose one provider and set its variables

# Option 1: Gmail
# GMAIL_EMAIL=your-email@gmail.com
# GMAIL_PASSWORD=your-app-password

# Option 2: Outlook/Office365
# OUTLOOK_EMAIL=your-email@outlook.com
# OUTLOOK_PASSWORD=your-password

# Option 3: Ionos
# IONOS_EMAIL=your-email@ionos.com
# IONOS_PASSWORD=your-password
# IONOS_HOST=smtp.ionos.de
# IONOS_PORT=587

# Option 4: MailerSend
# MAILERSEND_API_KEY=your-api-key
# MAILERSEND_SMTP_USER=your-smtp-user
# MAILERSEND_SMTP_PASS=your-smtp-password
# MAILERSEND_SMTP_HOST=smtp.mailersend.net
# MAILERSEND_SMTP_PORT=587

# ==================== WEB PUSH NOTIFICATIONS ====================
# Generate keys with: npx web-push generate-vapid-keys
# VAPID_PUBLIC_KEY=your-public-key
# VAPID_PRIVATE_KEY=your-private-key

# ==================== FEATURE FLAGS ====================
ENABLE_NEWSLETTER=true
ENABLE_MERCHANDISE=true
ENABLE_CALENDAR=true
ENABLE_REGISTRATIONS=true
ENABLE_FINANCE=true
`;

// Default values
const defaultConfig = {
  orgName: 'Chiro Vreugdeland',
  orgFullName: 'Chiro Vreugdeland Meeuwen',
  orgShortName: 'CHIRO VREUGDELAND',
  orgCity: 'Meeuwen',
  orgRegion: 'Limburg',
  orgPostalCode: '3670',
  orgAddress: 'Kloosterstraat 5',
  orgDomain: 'chiromeeuwen.be',
  orgDomainWww: 'www.chiromeeuwen.be',
  orgBaseUrl: 'https://www.chiromeeuwen.be',
  orgEmail: 'Chiromeeuwen@outlook.com',
  orgNoreplyEmail: 'noreply@chiromeeuwen.be',
  orgEmailName: 'Chiro Vreugdeland',
  orgFacebook: 'ChiroVreugdelandMeeuwen',
  orgKeywords: 'Chiro Meeuwen, Chiro Vreugdeland, jeugdbeweging, jeugdorganisatie, kinderen activiteiten, Meeuwen',
  orgDefaultDesc: 'Chiro Vreugdeland Meeuwen: jeugdbeweging voor kinderen in Meeuwen. Elke zondag spelen, activiteiten, vriendschap en plezier.',
  orgTagline: 'Elke zondag staan we klaar met een bende enthousiaste leiding om jullie kinderen de tijd van hun leven te bezorgen.',
  orgPrimaryColor: '#db3e41',
  orgSecondaryColor: '#ffd800',
  orgBgColor: '#fdfbf7',
  orgThemeColor: '#db3e41',
  orgLegalName: 'Chiro Vreugdeland Meeuwen',
  orgFoundingYear: '2024',
  orgVatNumber: '',
  sessionSecret: 'change_me_to_a_random_string',
  port: '3000',
  nodeEnv: 'development',
  appUrl: 'https://www.chiromeeuwen.be',
};

function prompt(question, defaultValue) {
  return new Promise((resolve) => {
    const displayDefault = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${displayDefault}: `, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

async function main() {
  log.title('╔════════════════════════════════════════════════════════════╗');
  log.title('║   Chiro Site - Organization Configuration Setup            ║');
  log.title('╚════════════════════════════════════════════════════════════╝');

  log.info('This tool will help you customize the application for your Chiro organization.');
  log.info('Press Enter to use the default value shown in brackets.\n');

  const config = {};

  // Organization Information
  log.title('📋 Organization Information');
  config.orgName = await prompt('Organization Name (without city)', defaultConfig.orgName);
  config.orgFullName = await prompt('Full Name with City', defaultConfig.orgFullName);
  config.orgShortName = await prompt('Short Name for Navbar (e.g., "CHIRO VREUGDELAND")', defaultConfig.orgShortName);
  config.orgCity = await prompt('City', defaultConfig.orgCity);
  config.orgRegion = await prompt('Region/Province', defaultConfig.orgRegion);
  config.orgPostalCode = await prompt('Postal Code', defaultConfig.orgPostalCode);
  config.orgAddress = await prompt('Street Address', defaultConfig.orgAddress);

  // Web Configuration
  log.title('🌐 Web Configuration');
  config.orgDomain = await prompt('Domain without www (e.g., example.be)', defaultConfig.orgDomain);
  config.orgDomainWww = await prompt('Domain with www', `www.${config.orgDomain}`);
  config.orgBaseUrl = await prompt('Full Base URL with protocol', `https://${config.orgDomainWww}`);

  // Contact Information
  log.title('📧 Contact Information');
  config.orgEmail = await prompt('Contact Email Address', defaultConfig.orgEmail);
  config.orgNoreplyEmail = await prompt('No-Reply Email Address', `noreply@${config.orgDomain}`);
  config.orgEmailName = await prompt('Email Display Name (for sent messages)', config.orgName);
  config.orgFacebook = await prompt('Facebook Page Name (without facebook.com/)', defaultConfig.orgFacebook);

  // SEO Information
  log.title('🔍 SEO & Meta Information');
  config.orgKeywords = await prompt('Meta Keywords (comma-separated)', config.orgFullName + ', jeugdbeweging, kinderen, activiteiten');
  config.orgDefaultDesc = await prompt('Default Meta Description', defaultConfig.orgDefaultDesc);
  config.orgTagline = await prompt('Organization Tagline/Slogan', defaultConfig.orgTagline);

  // Branding
  log.title('🎨 Branding Colors');
  log.info('Leave blank to keep current Chiro colors');
  config.orgPrimaryColor = await prompt('Primary Color (hex, e.g., #db3e41)', defaultConfig.orgPrimaryColor);
  config.orgSecondaryColor = await prompt('Secondary Color (hex, e.g., #ffd800)', defaultConfig.orgSecondaryColor);
  config.orgBgColor = await prompt('Background Color (hex)', defaultConfig.orgBgColor);
  config.orgThemeColor = await prompt('Theme Color (hex)', defaultConfig.orgThemeColor);

  // Legal Information
  log.title('⚖️ Legal Information');
  config.orgLegalName = await prompt('Legal Entity Name', config.orgFullName);
  config.orgFoundingYear = await prompt('Founding Year', defaultConfig.orgFoundingYear);
  config.orgVatNumber = await prompt('VAT Number (if applicable)', defaultConfig.orgVatNumber);

  // General Configuration
  log.title('⚙️ General Configuration');
  config.sessionSecret = await prompt('Session Secret (random string for security)', defaultConfig.sessionSecret);
  config.port = await prompt('Application Port', defaultConfig.port);
  config.nodeEnv = await prompt('Node Environment (development/production)', defaultConfig.nodeEnv);
  config.appUrl = await prompt('Application URL (for notifications)', config.orgBaseUrl || defaultConfig.appUrl);

  // Summary
  log.title('📝 Configuration Summary');
  console.log('\nOrganization:');
  console.log(`  Name: ${config.orgFullName}`);
  console.log(`  Address: ${config.orgAddress}, ${config.orgPostalCode} ${config.orgCity}`);
  console.log(`  Email: ${config.orgEmail}`);
  console.log(`\nWeb:');
  console.log(`  Domain: ${config.orgDomainWww}`);
  console.log(`  URL: ${config.orgBaseUrl}`);

  // Ask for confirmation
  console.log('');
  const confirm = await prompt('Save configuration to .env file? (yes/no)', 'yes');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    log.info('Setup cancelled. No changes made.');
    rl.close();
    process.exit(0);
  }

  // Write .env file
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = envTemplate(config);

  try {
    fs.writeFileSync(envPath, envContent);
    log.success(`.env file created/updated at ${envPath}`);
    log.info('You can now start the application with: npm start or node server.js');
  } catch (err) {
    log.error(`Failed to write .env file: ${err.message}`);
    process.exit(1);
  }

  log.title('✨ Setup Complete!');
  log.info('Next steps:');
  console.log('  1. Review the .env file and add email credentials');
  console.log('  2. Start the application with: node server.js');
  console.log('  3. Log in with admin credentials (default: leiding / chiro)');
  console.log('  4. Change the default admin password immediately');
  console.log('  5. Customize page content in the admin dashboard');

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  log.error(`Setup failed: ${err.message}`);
  rl.close();
  process.exit(1);
});
