const { User } = require('../models');

const args = process.argv.slice(2);
const command = args[0];
const username = (args[1] || '').toLowerCase();
const password = args[2];

async function manageAdmin() {
    try {
        if (command === 'add') {
            if (!username || !password) {
                console.log('Gebruik: node scripts/manage_admin.js add <username> <password>');
                process.exit(1);
            }
            await User.create({ username, password, role: 'admin' });
            console.log(`Admin '${username}' succesvol toegevoegd.`);
        } else if (command === 'remove') {
            if (!username) {
                console.log('Gebruik: node scripts/manage_admin.js remove <username>');
                process.exit(1);
            }
            const deleted = await User.destroy({ where: { username } });
            if (deleted) {
                console.log(`Admin '${username}' verwijderd.`);
            } else {
                console.log(`Admin '${username}' niet gevonden.`);
            }
        } else {
            console.log('Beschikbare commando\'s: add, remove');
        }
    } catch (error) {
        console.error('Fout:', error.message);
    } finally {
        await sequelize.close(); // Zorg dat de connectie sluit
    }
}

manageAdmin();
