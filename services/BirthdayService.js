const { User, Leader } = require('../models');
const NotificationService = require('./NotificationService');

class BirthdayService {
    static init() {
        console.log('BirthdayService: Initialized.');
        // Run once on startup (after a short delay to ensure everything is ready)
        setTimeout(() => {
            this.checkAndNotifyBirthdays();
        }, 5000);
        
        // Schedule to run every hour to check for a new day
        setInterval(() => {
            this.checkAndNotifyBirthdays();
        }, 1000 * 60 * 60); // Every hour
    }

    static async checkAndNotifyBirthdays() {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (this.lastCheckDate === dateString) {
            return;
        }

        console.log(`BirthdayService: Checking birthdays for ${dateString}...`);
        
        try {
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            const todayMMDD = `${month}-${day}`;

            const leaders = await Leader.findAll({
                attributes: ['name', 'birth_date']
            });

            const birthdayLeaders = leaders.filter(l => {
                if (!l.birth_date) return false;
                // birth_date is YYYY-MM-DD
                const parts = l.birth_date.split('-');
                if (parts.length < 3) return false;
                const leaderMMDD = `${parts[1]}-${parts[2]}`;
                return leaderMMDD === todayMMDD;
            });

            if (birthdayLeaders.length > 0) {
                const names = birthdayLeaders.map(l => l.name);
                let body = '';
                if (names.length === 1) {
                    body = `Heyy, ${names[0]} is jarig vandaag! Wens de jarige een gelukkige verjaardag! 🥳`;
                } else {
                    body = `Heyy, ${names.slice(0, -1).join(', ')} en ${names[names.length - 1]} zijn jarig vandaag! Wens hen een gelukkige verjaardag! 🥳`;
                }

                const messageData = {
                    title: '🎂 Verjaardag vandaag!',
                    body: body,
                    url: '/feed',
                    type: 'birthday'
                };

                const users = await User.findAll({
                    where: { isActive: true }
                });

                console.log(`BirthdayService: Sending birthday notifications for ${names.join(', ')} to ${users.length} users.`);
                
                // NotificationService.sendIndividualNotification handles preference checking for 'birthday' type
                await Promise.allSettled(users.map(u => NotificationService.sendIndividualNotification(u, messageData)));
            } else {
                console.log('BirthdayService: No birthdays today.');
            }

            this.lastCheckDate = dateString;
        } catch (error) {
            console.error('BirthdayService: Error checking birthdays:', error);
        }
    }
}

BirthdayService.lastCheckDate = null;

module.exports = BirthdayService;
