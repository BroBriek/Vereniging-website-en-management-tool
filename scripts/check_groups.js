const { FeedGroup } = require('../models');

async function seedGroups() {
    const count = await FeedGroup.count();
    console.log(`Current FeedGroup count: ${count}`);
    if (count === 0) {
        console.log('Seeding default FeedGroups...');
        await FeedGroup.create({ name: 'Algemene Leiding', slug: 'algemeen', description: 'Voor iedereen' });
        await FeedGroup.create({ name: 'Aspi Leiding', slug: 'aspi', description: 'Aspi leiding' });
        await FeedGroup.create({ name: 'Keti Leiding', slug: 'keti', description: 'Keti leiding' });
        await FeedGroup.create({ name: 'Tito Leiding', slug: 'tito', description: 'Tito leiding' });
        console.log('Seeded.');
    } else {
        console.log('FeedGroups already exist.');
    }
}

seedGroups().catch(console.error);
