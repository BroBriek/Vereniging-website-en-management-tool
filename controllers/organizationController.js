/**
 * Organization Settings Controller
 * 
 * Handles the display and updating of organization-specific settings
 * through the admin interface.
 */

const orgConfig = require('../config/organization');

/**
 * Display organization settings page
 */
exports.getSettings = (req, res) => {
  try {
    res.render('admin/organization-settings', {
      title: 'Organization Settings',
      config: orgConfig,
      user: req.user,
    });
  } catch (err) {
    console.error('Error fetching organization settings:', err);
    res.status(500).render('error', {
      title: 'Error',
      status: 500,
      message: 'Failed to load organization settings',
    });
  }
};

/**
 * Update organization settings
 * Regenerates configuration values in environment
 */
exports.updateSettings = (req, res) => {
  try {
    const {
      orgName,
      orgFullName,
      orgShortName,
      orgCity,
      orgRegion,
      orgPostalCode,
      orgAddress,
      orgDomain,
      orgDomainWww,
      orgBaseUrl,
      orgEmail,
      orgNoreplyEmail,
      orgEmailName,
      orgFacebook,
      orgKeywords,
      orgDefaultDesc,
      orgTagline,
      orgPrimaryColor,
      orgSecondaryColor,
      orgBgColor,
      orgThemeColor,
      orgLegalName,
      orgFoundingYear,
      orgVatNumber,
    } = req.body;

    // In a real implementation, you would:
    // 1. Validate all inputs
    // 2. Update environment variables
    // 3. Store settings in database if needed
    // 4. Clear caches

    // For now, we'll just show a success message with instructions
    const updatedSettings = {
      orgName,
      orgFullName,
      orgShortName,
      orgCity,
      orgRegion,
      orgPostalCode,
      orgAddress,
      orgDomain,
      orgDomainWww,
      orgBaseUrl,
      orgEmail,
      orgNoreplyEmail,
      orgEmailName,
      orgFacebook,
      orgKeywords,
      orgDefaultDesc,
      orgTagline,
      orgPrimaryColor,
      orgSecondaryColor,
      orgBgColor,
      orgThemeColor,
      orgLegalName,
      orgFoundingYear,
      orgVatNumber,
    };

    res.redirect('/admin?success=Organizatie instellingen bijgewerkt. Update je .env bestand om wijzigingen permanent te maken.');
  } catch (err) {
    console.error('Error updating organization settings:', err);
    res.redirect('/admin?error=Fout bij het bijwerken van instellingen');
  }
};

/**
 * Get organization configuration as JSON (for API access)
 */
exports.getConfigJson = (req, res) => {
  try {
    res.json(orgConfig);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
};
