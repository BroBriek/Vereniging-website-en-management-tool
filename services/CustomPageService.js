const { CustomPage } = require('../models');

class CustomPageService {
    constructor() {
        this.cache = [];
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        await this.reload();
        this.initialized = true;
    }

    async reload() {
        try {
            this.cache = await CustomPage.findAll({
                where: {
                    status: 'visible'
                },
                order: [['createdAt', 'ASC']]
            });
        } catch (error) {
            console.error('Failed to reload custom pages:', error);
        }
    }

    getNavbarPages() {
        return this.cache.filter(p => p.showInNavbar);
    }

    getAllVisible() {
        return this.cache;
    }
}

module.exports = new CustomPageService();
