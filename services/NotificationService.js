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
            const html = `
                <h3>Hallo ${user.username},</h3>
                <p>Er is een nieuwe melding voor jou op ChiroSite:</p>
                <div style="border-left: 4px solid #d9534f; padding-left: 10px; margin: 15px 0;">
                    <h4>${messageData.title}</h4>
                    <p>${messageData.body}</p>
                </div>
                <p><a href="${messageData.url}" style="background-color: #d9534f; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Bekijk Melding</a></p>
                <p style="font-size: 0.8em; color: #777;">Je ontvangt deze e-mail omdat je e-mailmeldingen hebt ingeschakeld. Je kunt dit wijzigen in je accountinstellingen.</p>
            `;

            await sendMail({
                to: user.email,
                subject: `Nieuwe melding: ${messageData.title}`,
                text: `${messageData.title}: ${messageData.body}. Bekijk het hier: ${messageData.url}`,
                html: html
            });
        } catch (error) {
            console.error(`NotificationService: Email failed for ${user.email}`, error);
        }
    }
}

module.exports = NotificationService;
