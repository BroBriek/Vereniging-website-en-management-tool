/**
 * Organization Configuration
 * 
 * This file contains organization-specific settings that are used throughout the application.
 * Customize these values to match your Chiro organization's details.
 * 
 * Default values are for Chiro Vreugdeland Meeuwen.
 */

module.exports = {
  // ==================== ORGANIZATION INFO ====================
  organization: {
    // Full official name of the organization
    name: process.env.ORG_NAME || 'Chiro Vreugdeland',
    
    // Name with location/suffix (used for titles and meta tags)
    fullName: process.env.ORG_FULL_NAME || 'Chiro Vreugdeland Meeuwen',
    
    // Short name for navbar and logos (usually just "CHIRO [NAME]")
    shortName: process.env.ORG_SHORT_NAME || 'CHIRO VREUGDELAND',
    
    // Location/City
    city: process.env.ORG_CITY || 'Meeuwen',
    
    // Province/Region
    region: process.env.ORG_REGION || 'Limburg',
    
    // Postal Code
    postalCode: process.env.ORG_POSTAL_CODE || '3670',
    
    // Full street address
    address: process.env.ORG_ADDRESS || 'Kloosterstraat 5',
  },

  // ==================== WEB CONFIGURATION ====================
  web: {
    // Primary domain (without www)
    domain: process.env.ORG_DOMAIN || 'chiromeeuwen.be',
    
    // Primary domain with www
    domainWww: process.env.ORG_DOMAIN_WWW || 'www.chiromeeuwen.be',
    
    // Full base URL with protocol
    baseUrl: process.env.ORG_BASE_URL || 'https://www.chiromeeuwen.be',
    
    // Fallback URL for notifications (if APP_URL not set)
    fallbackUrl: process.env.ORG_FALLBACK_URL || 'https://www.chiromeeuwen.be',
  },

  // ==================== CONTACT INFORMATION ====================
  contact: {
    // Contact email
    email: process.env.ORG_EMAIL || 'Chiromeeuwen@outlook.com',
    
    // Email for automated messages (like registrations)
    noreplyEmail: process.env.ORG_NOREPLY_EMAIL || 'noreply@chiromeeuwen.be',
    
    // Email display name for sent messages
    emailName: process.env.ORG_EMAIL_NAME || 'Chiro Vreugdeland',
    
    // Facebook page (optional)
    facebook: process.env.ORG_FACEBOOK || 'ChiroVreugdelandMeeuwen',
  },

  // ==================== SEO & META TAGS ====================
  seo: {
    // Keywords for meta tags
    keywords: process.env.ORG_KEYWORDS || 'Chiro Meeuwen, Chiro Vreugdeland, jeugdbeweging, jeugdorganisatie, kinderen activiteiten, Meeuwen',
    
    // Default page description (used as fallback)
    defaultDescription: process.env.ORG_DEFAULT_DESC || 'Chiro Vreugdeland Meeuwen: jeugdbeweging voor kinderen in Meeuwen. Elke zondag spelen, activiteiten, vriendschap en plezier.',
    
    // Tagline/Slogan
    tagline: process.env.ORG_TAGLINE || 'Elke zondag staan we klaar met een bende enthousiaste leiding om jullie kinderen de tijd van hun leven te bezorgen.',
  },

  // ==================== BRANDING ====================
  branding: {
    // Primary color (used for logos, buttons, etc.) - Chiro red
    primaryColor: process.env.ORG_PRIMARY_COLOR || '#db3e41',
    
    // Secondary color (used for accents) - Chiro yellow
    secondaryColor: process.env.ORG_SECONDARY_COLOR || '#ffd800',
    
    // Background color (for PWA)
    backgroundColor: process.env.ORG_BG_COLOR || '#fdfbf7',
    
    // Theme color (for browser UI)
    themeColor: process.env.ORG_THEME_COLOR || '#db3e41',
  },

  // ==================== FEATURE FLAGS ====================
  features: {
    // Enable/disable newsletter functionality
    enableNewsletter: process.env.ENABLE_NEWSLETTER !== 'false',
    
    // Enable/disable merchandise/t-shirt selling
    enableMerchandise: process.env.ENABLE_MERCHANDISE !== 'false',
    
    // Enable/disable event calendar
    enableCalendar: process.env.ENABLE_CALENDAR !== 'false',
    
    // Enable/disable member registrations
    enableRegistrations: process.env.ENABLE_REGISTRATIONS !== 'false',
    
    // Enable/disable finance management
    enableFinance: process.env.ENABLE_FINANCE !== 'false',
  },

  // ==================== LEGAL ====================
  legal: {
    // Year of establishment
    foundingYear: process.env.ORG_FOUNDING_YEAR || 2024,
    
    // Legal entity name (for privacy notices, etc.)
    legalName: process.env.ORG_LEGAL_NAME || 'Chiro Vreugdeland Meeuwen',
    
    // VAT number (if applicable)
    vatNumber: process.env.ORG_VAT_NUMBER || '',
  },
};
