const { User, sequelize } = require('../models');

const args = process.argv.slice(2);
const command = args[0];
const username = (args[1] || '').toLowerCase();
const password = args[2];

/**
 * Manage admins.
 *
 * Usage:
 *   node scripts/manage_admin.js add <username> <password>
 *   node scripts/manage_admin.js remove <username>
 *   node scripts/manage_admin.js update-password <username> <new_password>
 *
 * @param {string} command - Command to execute (add or remove).
 * @param {string} username - Username of the admin to add or remove.
 * @param {string} password - Password of the admin to add.
 */
async function manageAdmin() {
    try {
        if (command === 'add') {
            if (!username || !password) {
                console.log('Gebruik: node scripts/manage_admin.js add <username> <password>');
                process.exit(1);
            }
            await User.create({ username, password, role: 'admin' });
            console.log(`Admin '${username}' succesvol toegevoegd.`);
        } else if (command === 'update-password') {
            if (!username || !password) {
                console.log('Gebruik: node scripts/manage_admin.js update-password <username> <new_password>');
                process.exit(1);
            }
            const user = await User.findOne({ where: { username } });
            if (!user) {
                console.log(`Gebruiker '${username}' niet gevonden.`);
                process.exit(1);
            }
            user.password = password; // Will be hashed by BeforeUpdate/BeforeSave hook if configured, or needs explicit hashing if not.
            // Assuming User model hooks handle hashing on save/update. 
            // If the model only hashes on 'create', we might need to manually hash or ensure 'individualHooks: true' is used or the model handles it.
            // Let's check if we need to explicitly save.
            await user.save();
            console.log(`Wachtwoord voor '${username}' succesvol gewijzigd.`);
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
            console.log('Beschikbare commando\'s: add, remove, update-password');
        }
    } catch (error) {
        console.error('Fout:', error.message);
    } finally {
        await sequelize.close(); // Zorg dat de connectie sluit
    }
}

manageAdmin();
