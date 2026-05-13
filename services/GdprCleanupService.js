const { Registration } = require('../models');
const { Op } = require('sequelize');

class GdprCleanupService {
    static init() {
        console.log('GdprCleanupService: Initialized.');
        
        // Run cleanup on startup after a short delay
        setTimeout(() => {
            this.cleanupMedicalInfo();
        }, 15000); // 15 seconds delay

        // Schedule to run every 24 hours
        setInterval(() => {
            this.cleanupMedicalInfo();
        }, 1000 * 60 * 60 * 24);
    }

    static async cleanupMedicalInfo() {
        try {
            console.log('GdprCleanupService: Checking for medical info that needs deletion...');
            
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const deletedMessage = "Deze info is verwijderd om ons te houden aan de GDPR.";

            // Find registrations older than 1 year with non-null medical info that isn't already the deleted message
            // We use updatedAt as the reference for "last update"
            const registrationsToUpdate = await Registration.findAll({
                where: {
                    updatedAt: {
                        [Op.lt]: oneYearAgo
                    },
                    medicalInfo: {
                        [Op.and]: [
                            { [Op.ne]: null },
                            { [Op.ne]: '' },
                            { [Op.ne]: deletedMessage }
                        ]
                    }
                }
            });

            if (registrationsToUpdate.length === 0) {
                console.log('GdprCleanupService: No medical info to clean up today.');
                return;
            }

            console.log(`GdprCleanupService: Cleaning up medical info for ${registrationsToUpdate.length} registrations...`);

            let updatedCount = 0;
            for (const reg of registrationsToUpdate) {
                // We use update instead of save to avoid updating updatedAt again if we don't want to, 
                // but actually updating it to NOW is fine because it marks when the "deletion" happened.
                // However, the user said "a year after the last update of the data".
                // If we update it now, it won't be eligible for cleanup for another year, which is fine since it's already "deleted".
                
                reg.medicalInfo = deletedMessage;
                await reg.save();
                updatedCount++;
            }

            console.log(`GdprCleanupService: Successfully cleaned up ${updatedCount} registrations.`);

        } catch (error) {
            console.error('GdprCleanupService Error:', error);
        }
    }
}

module.exports = GdprCleanupService;
