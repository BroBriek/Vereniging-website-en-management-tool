const { Registration, SystemState } = require('../models');
const { sendMail } = require('../config/mailer');
const { Op } = require('sequelize');

class RegistrationUpdateService {
    static init() {
        console.log('RegistrationUpdateService: Initialized.');
        
        // Run check on startup after short delay
        setTimeout(() => {
            this.checkAndSendUpdate();
        }, 10000); // 10 seconds delay to avoid startup congestion

        // Schedule to run every hour to check if it's been a week
        setInterval(() => {
            this.checkAndSendUpdate();
        }, 1000 * 60 * 60); // Every hour
    }

    static async checkAndSendUpdate() {
        try {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            
            // Check when the last update was sent
            let lastUpdateState = await SystemState.findOne({ where: { key: 'last_registration_update_date' } });
            let lastIdState = await SystemState.findOne({ where: { key: 'last_registration_update_id' } });
            
            let lastUpdateDate = lastUpdateState ? new Date(lastUpdateState.value) : null;
            let lastId = lastIdState ? parseInt(lastIdState.value) : 0;

            // If we have sent an update in the last 7 days, skip
            if (lastUpdateDate) {
                const diffTime = Math.abs(now - lastUpdateDate);
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                if (diffDays < 7) {
                    return;
                }
            }

            // Find new registrations since lastId
            const newRegistrations = await Registration.findAll({
                where: {
                    id: { [Op.gt]: lastId }
                },
                order: [['id', 'ASC']]
            });

            if (newRegistrations.length === 0) {
                console.log('RegistrationUpdateService: No new registrations this week.');
                // Update the date even if no registrations were found to reset the 7-day timer
                await SystemState.upsert({
                    key: 'last_registration_update_date',
                    value: todayStr
                });
                return;
            }

            console.log(`RegistrationUpdateService: Found ${newRegistrations.length} new registrations. Sending update...`);

            // Build Email Content
            let tableRows = '';
            newRegistrations.forEach(reg => {
                tableRows += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${reg.firstName} ${reg.lastName}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${reg.group}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${reg.type}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${reg.email}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(reg.createdAt).toLocaleDateString('nl-BE')}</td>
                    </tr>
                `;
            });

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #db3e41; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">Wekelijkse Inschrijvingen Update</h1>
                    </div>
                    <div style="padding: 30px;">
                        <p>Beste,</p>
                        <p>Hierbij een overzicht van de <strong>${newRegistrations.length} nieuwe inschrijvingen</strong> van de afgelopen week:</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #ddd;">Naam</th>
                                    <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #ddd;">Groep</th>
                                    <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #ddd;">Type</th>
                                    <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #ddd;">Email</th>
                                    <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #ddd;">Datum</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                        
                        <p style="margin-top: 30px;">Je kunt alle details bekijken in het <a href="${(process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '')}/admin/registrations" style="color: #db3e41; font-weight: bold;">admin dashboard</a>.</p>
                        
                        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
                            Dit is een automatisch verzonden bericht van de ${process.env.ORG_NAME || 'Chiro'} website.
                        </div>
                    </div>
                </div>
            `;

            await sendMail({
                to: process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'admin@example.com',
                subject: `📢 Wekelijkse Update: ${newRegistrations.length} Nieuwe Inschrijvingen`,
                html: emailHtml
            });

            // Update state
            const maxId = newRegistrations[newRegistrations.length - 1].id;
            await SystemState.upsert({
                key: 'last_registration_update_id',
                value: maxId.toString()
            });
            await SystemState.upsert({
                key: 'last_registration_update_date',
                value: todayStr
            });

            console.log('RegistrationUpdateService: Update email sent successfully.');

        } catch (error) {
            console.error('RegistrationUpdateService Error:', error);
        }
    }
}

module.exports = RegistrationUpdateService;
