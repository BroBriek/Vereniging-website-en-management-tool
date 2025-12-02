const { sequelize, User, PageContent } = require('../models');

const seed = async () => {
    try {
        await sequelize.sync();

        // Check for admin
        const admin = await User.findOne({ where: { username: 'leiding' } });
        if (!admin) {
            await User.create({
                username: 'leiding',
                password: 'chiro', // Default simple password
                role: 'admin'
            });
            console.log('Admin user created: leiding / chiro');
        } else {
            console.log('Admin user already exists.');
        }

        // Seed basic page content if empty
        const homeIntro = await PageContent.findOne({ where: { slug: 'home', section_key: 'intro' } });
        if (!homeIntro) {
            await PageContent.create({ slug: 'home', section_key: 'intro', content: '<p class="lead">Elke zondag staan we klaar met een bende enthousiaste leiding om jullie kinderen de tijd van hun leven te bezorgen.</p><p>Kom gerust eens proberen!</p>' });
            await PageContent.create({ slug: 'home', section_key: 'hero_title', content: 'Welkom bij Chiro' });
            await PageContent.create({ slug: 'home', section_key: 'hero_text', content: 'Samen spelen, samen leven' });
        }

        console.log('Database seeded!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();