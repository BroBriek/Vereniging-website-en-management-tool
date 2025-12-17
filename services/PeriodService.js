const { PageContent } = require('../models');

const SLUG = 'config';
const KEY = 'current_period';
const DEFAULT_PERIOD = '2024-2025';

exports.getCurrentPeriod = async () => {
    const setting = await PageContent.findOne({ where: { slug: SLUG, section_key: KEY } });
    return setting ? setting.content : DEFAULT_PERIOD;
};

exports.setCurrentPeriod = async (period) => {
    const existing = await PageContent.findOne({ where: { slug: SLUG, section_key: KEY } });
    if (existing) {
        await existing.update({ content: period });
    } else {
        await PageContent.create({ slug: SLUG, section_key: KEY, content: period });
    }
};

exports.startNewPeriod = async () => {
    const current = await exports.getCurrentPeriod();
    // Try to parse "YYYY-YYYY"
    const parts = current.split('-');
    if (parts.length === 2) {
        const start = parseInt(parts[0]);
        const end = parseInt(parts[1]);
        if (!isNaN(start) && !isNaN(end)) {
            const next = `${start + 1}-${end + 1}`;
            await exports.setCurrentPeriod(next);
            return next;
        }
    }
    // Fallback logic
    const year = new Date().getFullYear();
    const next = `${year}-${year + 1}`;
    await exports.setCurrentPeriod(next);
    return next;
};
