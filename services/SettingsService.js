const { SystemState } = require('../models');

class SettingsService {
    constructor() {
        this.cache = {};
        this.initialized = false;
        
        // Define default settings and their source/type
        this.settingDefinitions = {
            disable_contact_form: { env: 'DISABLE_CONTACT_FORM', type: 'boolean', default: false },
            show_games_to_all: { env: 'SHOW_GAMES_TO_ALL', type: 'boolean', default: true },
            enable_public_registrations_view: { env: 'ENABLE_PUBLIC_REGISTRATIONS_VIEW', type: 'boolean', default: true },
            allow_all_forms_access: { env: 'ALLOW_ALL_FORMS_ACCESS', type: 'boolean', default: false },
            
            // Theme Colors
            theme_color_primary: { default: '#db3e41' },   // --chiro-red
            theme_color_secondary: { default: '#1d4e89' }, // --chiro-blue
            theme_color_accent: { default: '#f2a900' },    // --chiro-yellow
            theme_color_neutral: { default: '#724c2a' },   // --chiro-brown
            theme_color_bg: { default: '#fdfbf7' },        // --bg-color
            theme_color_text: { default: '#333333' }       // --text-color
        };

        // Pre-initialize with defaults
        this.cache = this.getDefaults();
    }

    async init() {
        if (this.initialized) return;
        await this.reload();
        this.initialized = true;
    }

    async reload() {
        try {
            const dbSettings = await SystemState.findAll();
            const settingsMap = {};
            dbSettings.forEach(s => settingsMap[s.key] = s.value);

            const newCache = {};

            for (const [key, def] of Object.entries(this.settingDefinitions)) {
                let value;

                // 1. Check DB override
                if (settingsMap[key] !== undefined) {
                    value = settingsMap[key];
                } 
                // 2. Check ENV
                else if (def.env && process.env[def.env] !== undefined) {
                    value = process.env[def.env];
                }
                // 3. Use Default
                else {
                    value = def.default;
                }

                // Type conversion
                if (def.type === 'boolean') {
                    newCache[key] = value === 'true' || value === true;
                } else if (def.type === 'number') {
                    newCache[key] = parseInt(value, 10);
                } else {
                    newCache[key] = value;
                }
            }

            this.cache = newCache;
        } catch (error) {
            console.error('Failed to reload site settings:', error);
            // Keep existing cache (which has defaults at minimum)
        }
    }

    get(key) {
        if (!this.initialized || this.cache[key] === undefined) {
            const def = this.settingDefinitions[key];
            if (!def) return undefined;
            if (def.env && process.env[def.env] !== undefined) {
                let val = process.env[def.env];
                if (def.type === 'boolean') return val === 'true';
                if (def.type === 'number') return parseInt(val, 10);
                return val;
            }
            return def.default;
        }
        return this.cache[key];
    }

    getAll() {
        if (!this.initialized || Object.keys(this.cache).length === 0) {
            return this.getDefaults();
        }
        return { ...this.cache };
    }

    getDefaults() {
        const defaults = {};
        for (const [key, def] of Object.entries(this.settingDefinitions)) {
            if (def.env && process.env[def.env] !== undefined) {
                let val = process.env[def.env];
                if (def.type === 'boolean') val = (val === 'true');
                if (def.type === 'number') val = parseInt(val, 10);
                defaults[key] = val;
            } else {
                defaults[key] = def.default;
            }
        }
        return defaults;
    }

    async set(key, value) {
        if (!this.settingDefinitions[key]) throw new Error(`Unknown setting: ${key}`);
        
        await SystemState.upsert({
            key: key,
            value: value.toString()
        });
        
        await this.reload();
    }

    async setMany(settings) {
        for (const [key, value] of Object.entries(settings)) {
            if (this.settingDefinitions[key]) {
                await SystemState.upsert({
                    key: key,
                    value: value !== null ? value.toString() : null
                });
            }
        }
        await this.reload();
    }

    async reset() {
        const keys = Object.keys(this.settingDefinitions);
        await SystemState.destroy({
            where: {
                key: keys
            }
        });
        await this.reload();
    }
}

module.exports = new SettingsService();
