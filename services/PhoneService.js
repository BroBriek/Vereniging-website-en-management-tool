/**
 * Service for handling phone number formatting and validation
 */

/**
 * Sanitizes and formats Belgian phone numbers to "0XXX XX XX XX" or "0XX XX XX XX"
 * @param {string} phone 
 * @returns {string|null}
 */
const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    
    // Remove all non-digits, but keep leading +
    let cleaned = phone.trim();
    const isPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/\D/g, '');
    if (isPlus) cleaned = '+' + cleaned;
    
    // Normalize 00 prefix to +
    if (cleaned.startsWith('00')) {
        cleaned = '+' + cleaned.substring(2);
    }
    
    // Handle Belgian prefix (+32 or 32)
    if (cleaned.startsWith('+32') && cleaned.length > 10) {
        cleaned = '0' + cleaned.substring(3);
    } else if (cleaned.startsWith('32') && cleaned.length > 9) {
        cleaned = '0' + cleaned.substring(2);
    }
    
    // Apply Belgian spacing if it's a local Belgian number
    if (cleaned.startsWith('0')) {
        if (cleaned.length === 10) {
            return cleaned.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
        } else if (cleaned.length === 9) {
            return cleaned.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
        }
    }
    
    // For international numbers, return sanitized with + prefix
    return cleaned;
};

/**
 * Regex for validated phone number format
 * Allows:
 * 1. Belgian local: 0470 12 34 56 or 011 12 34 56
 * 2. International: +31612345678 (no spaces required for international)
 */
const phoneRegex = /^(0\d{2,3} \d{2} \d{2} \d{2})|(\+\d{7,15})$/;

/**
 * Validates a formatted phone number
 * @param {string} phone 
 * @returns {boolean}
 */
const isValidFormat = (phone) => {
    if (!phone) return true; // Optional fields are valid if empty
    return phoneRegex.test(phone);
};

module.exports = {
    formatPhoneNumber,
    isValidFormat,
    phoneRegex
};
