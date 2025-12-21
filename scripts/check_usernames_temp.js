const { User } = require('../models');

async function checkUsers() {
  try {
    const users = await User.findAll();
    console.log('--- Usernames ---');
    users.forEach(u => {
      console.log(`"${u.username}" -> "${u.username.toLowerCase()}" (Needs change: ${u.username !== u.username.toLowerCase()})`);
    });
  } catch (err) {
    console.error(err);
  }
}

checkUsers();