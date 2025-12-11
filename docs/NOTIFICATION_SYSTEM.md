# Notification System

This project uses a centralized `NotificationService` to handle Web Push and Email notifications.

## Features

- **Unified Sending:** Send via Push and Email with a single call.
- **Group Targeting:** Send to all members of a `FeedGroup`.
- **Stale Subscription Cleanup:** Automatically removes invalid push subscriptions (410 Gone).
- **Dynamic Routing:** Push notifications open specific URLs (e.g., a specific post or comment).

## Usage

### Import

```javascript
const NotificationService = require('../services/NotificationService');
```

### Send Individual Notification

```javascript
await NotificationService.sendIndividualNotification(userId, {
    title: 'Hello User',
    body: 'This is a personal message',
    url: '/account/settings' // Optional, defaults to /feed
});
```

### Send Group Notification

Sends to all users linked to the group via `UserGroupAccess`.

```javascript
await NotificationService.sendGroupNotification(groupId, {
    title: 'New Group Post',
    body: 'Someone posted in your group',
    url: `/feed/group/${groupSlug}`
});
```

## Configuration

### Environment Variables

Ensure these are set in your `.env` file (or environment) for Web Push to work:

```env
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
mailto=admin@yoursite.com
```

### VAPID Keys Generation

If you need new keys, run:

```bash
npx web-push generate-vapid-keys
```

## Architecture

- **Service:** `services/NotificationService.js`
- **Frontend Worker:** `public/sw.js` (Handles display and click actions)
- **User Model:** Stores `pushSubscriptions` (JSON) and `emailNotificationsEnabled` (Boolean).
