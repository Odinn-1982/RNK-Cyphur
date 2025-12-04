/**
 * RNK Cyphur - Localization Helper
 * Utility for managing localization strings
 */

const MODULE_ID = 'rnk-cyphur';

/**
 * Get a localized string with optional formatting
 * @param {string} key - Localization key
 * @param {object} data - Formatting data
 * @returns {string}
 */
export function localize(key, data = {}) {
    const fullKey = key.startsWith('CYPHUR.') ? key : `CYPHUR.${key}`;
    
    if (Object.keys(data).length > 0) {
        return game.i18n.format(fullKey, data);
    }
    return game.i18n.localize(fullKey);
}

/**
 * Check if a localization key exists
 * @param {string} key - Localization key
 * @returns {boolean}
 */
export function hasLocalization(key) {
    const fullKey = key.startsWith('CYPHUR.') ? key : `CYPHUR.${key}`;
    return game.i18n.has(fullKey);
}

/**
 * Get all localization keys for debugging
 * @returns {object}
 */
export function getLocalizations() {
    const translations = game.i18n.translations;
    const cyphurKeys = {};
    
    for (const [key, value] of Object.entries(translations)) {
        if (key.startsWith('CYPHUR.')) {
            cyphurKeys[key] = value;
        }
    }
    
    return cyphurKeys;
}

// Make available globally for templates
Hooks.once('init', () => {
    Handlebars.registerHelper('cyphurLocalize', function(key, options) {
        const data = options?.hash || {};
        return localize(key, data);
    });
});
