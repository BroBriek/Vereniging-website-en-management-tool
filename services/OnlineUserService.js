class OnlineUserService {
    constructor() {
        // In-memory map: sessionId/key -> activity object
        this.activeSessions = new Map();
        
        // Clean up stale sessions every 60 seconds
        const timer = setInterval(() => this.cleanup(), 60 * 1000);
        if (timer && typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    /**
     * Records user/guest activity on an HTTP request
     */
    recordActivity(req) {
        if (!req) return;

        const path = req.originalUrl || req.path || '';

        // Ignore static assets and system background polling endpoints
        if (
            path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json|back|zip)$/i) ||
            path.startsWith('/admin/api/online-users') ||
            path.startsWith('/admin/api/pm2-logs') ||
            path.startsWith('/favicon.ico')
        ) {
            return;
        }

        const now = new Date();
        const ipAddress = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '127.0.0.1')
            .toString()
            .split(',')[0]
            .trim();
        const userAgent = req.headers['user-agent'] || 'Unknown Browser';

        let sessionKey;
        let userId = null;
        let username = null;
        let role = null;
        let profilePicture = null;

        if (req.user && req.user.id) {
            userId = req.user.id;
            username = req.user.username;
            role = req.user.role || 'user';
            profilePicture = req.user.profilePicture || null;
            // Key by userId so multiple sessions of the same logged in user map consistently
            sessionKey = `user_${userId}`;
        } else {
            const sid = req.sessionID || req.session?.id;
            if (sid) {
                sessionKey = `guest_sess_${sid}`;
            } else {
                // Fallback for requests without explicit sessionID
                const hashStr = `${ipAddress}_${userAgent.substring(0, 50)}`;
                sessionKey = `guest_ip_${hashStr}`;
            }
        }

        this.activeSessions.set(sessionKey, {
            sessionKey,
            userId,
            username,
            role,
            profilePicture,
            ipAddress,
            userAgent,
            lastPath: path,
            lastActive: now
        });
    }

    /**
     * Returns online users active within the threshold window (default: 5 minutes)
     */
    getOnlineUsers(windowMinutes = 5) {
        const now = Date.now();
        const windowMs = windowMinutes * 60 * 1000;

        const loggedInUsersMap = new Map();
        const guestsList = [];

        for (const [key, session] of this.activeSessions.entries()) {
            const timeDiff = now - session.lastActive.getTime();
            if (timeDiff <= windowMs) {
                const secondsAgo = Math.floor(timeDiff / 1000);
                const sessionData = {
                    ...session,
                    secondsAgo
                };

                if (session.userId) {
                    // Keep most recent activity per user
                    const existing = loggedInUsersMap.get(session.userId);
                    if (!existing || existing.lastActive < session.lastActive) {
                        loggedInUsersMap.set(session.userId, sessionData);
                    }
                } else {
                    guestsList.push(sessionData);
                }
            }
        }

        const loggedInUsers = Array.from(loggedInUsersMap.values()).sort((a, b) => b.lastActive - a.lastActive);
        guestsList.sort((a, b) => b.lastActive - a.lastActive);

        return {
            totalCount: loggedInUsers.length + guestsList.length,
            loggedInCount: loggedInUsers.length,
            guestCount: guestsList.length,
            windowMinutes,
            loggedInUsers,
            guests: guestsList
        };
    }

    /**
     * Remove sessions inactive for over 15 minutes
     */
    cleanup() {
        const now = Date.now();
        const maxAgeMs = 15 * 60 * 1000;
        for (const [key, session] of this.activeSessions.entries()) {
            if (now - session.lastActive.getTime() > maxAgeMs) {
                this.activeSessions.delete(key);
            }
        }
    }
}

module.exports = new OnlineUserService();
