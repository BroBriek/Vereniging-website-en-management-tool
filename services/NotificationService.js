const webpush = require('web-push');
const { User, FeedGroup, UserGroupAccess } = require('../models');
const { sendMail } = require('../config/mailer');

class NotificationService {
    
    /**
     * Send a notification to a single user via all enabled channels (Push, Email).
     * @param {User|number} userOrId - The User instance or ID.
     * @param {Object} messageData - Notification content.
     * @param {string} messageData.title - Title of the notification.
     * @param {string} messageData.body - Body text.
     * @param {string} messageData.url - URL to open on click.
     */
    static async sendIndividualNotification(userOrId, messageData) {
        try {
            let user = userOrId;
            if (typeof userOrId === 'number' || typeof userOrId === 'string') {
                user = await User.findByPk(userOrId);
            }

            if (!user) {
                console.error(`NotificationService: User not found for ID ${userOrId}`);
                return;
            }

            const promises = [];

            // 1. Web Push Notifications
            if (user.pushSubscriptions && Array.isArray(user.pushSubscriptions) && user.pushSubscriptions.length > 0) {
                promises.push(this._sendPushNotifications(user, messageData));
            }

            // 2. Email Notification
            if (user.emailNotificationsEnabled && user.email && user.emailVerified) {
                promises.push(this._sendEmailNotification(user, messageData));
            }

            await Promise.allSettled(promises);

        } catch (error) {
            console.error('NotificationService: Error sending individual notification:', error);
        }
    }

    /**
     * Send a notification to all users who have access to a specific group.
     * @param {number} groupId - The ID of the FeedGroup.
     * @param {Object} messageData - Notification content.
     */
    static async sendGroupNotification(groupId, messageData) {
        try {
            // Find all users who are members of this group
            // We use the association defined in models/index.js
            const users = await User.findAll({
                include: [{
                    model: FeedGroup,
                    as: 'accessibleGroups',
                    where: { id: groupId },
                    required: true, // Only users who have this group
                    attributes: [] // We don't need group data, just the filtering
                }]
            });

            console.log(`NotificationService: Sending group notification to ${users.length} users for group ${groupId}`);

            // Send to each user
            // using Promise.all to run in parallel, but catch errors individually
            const notifications = users.map(user => this.sendIndividualNotification(user, messageData));
            await Promise.allSettled(notifications);

        } catch (error) {
            console.error('NotificationService: Error sending group notification:', error);
        }
    }

    /**
     * Internal: Send Push Notifications to all user subscriptions.
     * Handles 410 Gone errors by removing stale subscriptions.
     */
    static async _sendPushNotifications(user, messageData) {
        const payload = JSON.stringify(messageData);
        let subscriptionsChanged = false;
        const currentSubscriptions = [...user.pushSubscriptions];

        const pushPromises = currentSubscriptions.map(async (sub, index) => {
            try {
                await webpush.sendNotification(sub, payload);
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription is gone, mark for removal
                    console.log(`NotificationService: Removing stale subscription for user ${user.username}`);
                    // We set it to null in the original array copy to filter later
                    // (But index management is tricky with map, so we'll just filter `currentSubscriptions` later based on failures?)
                    // Actually, simpler to filter the user's subscriptions array directly
                    // But we can't mutate safely while iterating.
                    return { success: false, subToRemove: sub };
                }
                console.error('NotificationService: Push error', err.statusCode, err.body);
            }
            return { success: true };
        });

        const results = await Promise.all(pushPromises);

        // Cleanup stale subscriptions
        const subscriptionsToRemove = results
            .filter(r => !r.success && r.subToRemove)
            .map(r => r.subToRemove);

        if (subscriptionsToRemove.length > 0) {
            user.pushSubscriptions = user.pushSubscriptions.filter(s => 
                !subscriptionsToRemove.some(rem => rem.endpoint === s.endpoint)
            );
            user.changed('pushSubscriptions', true);
            await user.save();
        }
    }

    /**
     * Internal: Send Email Notification.
     */
    static async _sendEmailNotification(user, messageData) {
        try {
            // Determine Base URL (fallback to chiromeeuwen.be if not set in ENV)
            const baseUrl = process.env.APP_URL || 'https://chiromeeuwen.be';
            
            // Fix URL: ensure it is absolute
            let fullUrl = messageData.url;
            if (fullUrl && !fullUrl.startsWith('http')) {
                // Remove leading slash if both have it to avoid double slash
                if (fullUrl.startsWith('/')) {
                    fullUrl = `${baseUrl}${fullUrl}`;
                } else {
                    fullUrl = `${baseUrl}/${fullUrl}`;
                }
            }

            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { background-color: #db0029; color: #ffffff; padding: 30px 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
                    .content { padding: 30px; color: #333333; line-height: 1.6; }
                    .notification-box { background-color: #fff5f5; border-left: 5px solid #db0029; padding: 20px; margin: 20px 0; border-radius: 4px; }
                    .notification-title { margin-top: 0; color: #db0029; font-size: 18px; font-weight: bold; }
                    .btn { display: inline-block; background-color: #db0029; color: #ffffff !important; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 20px; text-align: center; }
                    .footer { background-color: #333333; color: #cccccc; padding: 20px; text-align: center; font-size: 12px; }
                    .footer a { color: #cccccc; text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Chiro Vreugdeland</h1>
                    </div>
                    <div class="content">
                        <p>Dag <strong>${user.username}</strong>,</p>
                        <p>Er is een nieuwe update voor jou:</p>
                        
                        <div class="notification-box">
                            <div class="notification-title">${messageData.title}</div>
                            <p style="margin-bottom: 0;">${messageData.body}</p>
                        </div>

                        <div style="text-align: center;">
                            <a href="${fullUrl}" class="btn">Bekijk Melding</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Je ontvangt deze e-mail omdat notificaties zijn ingeschakeld voor jouw account.</p>
                        <p>&copy; ${new Date().getFullYear()} Chiro Vreugdeland Meeuwen</p>
                    </div>
                </div>
            </body>
            </html>
            `;

            await sendMail({
                to: user.email,
                subject: `📢 ${messageData.title}`,
                text: `${messageData.title}: ${messageData.body}. Bekijk het hier: ${fullUrl}`,
                html: html
            });
        } catch (error) {
            console.error(`NotificationService: Email failed for ${user.email}`, error);
        }
    }
}

module.exports = NotificationService;
