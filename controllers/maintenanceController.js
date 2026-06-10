const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { sequelize, User, CalendarAccess } = require('../models');
const { Op } = require('sequelize');
const NotificationService = require('../services/NotificationService');

const PUBLIC_PATH = path.join(__dirname, '..', 'public');

// ==================== Calendar Stats ====================
exports.getCalendarStats = async (req, res) => {
    try {
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const totalRequests = await CalendarAccess.count({
            where: {
                requestedAt: { [Op.gte]: thirtyDaysAgo }
            }
        });

        const userRequests = await CalendarAccess.findAll({
            where: {
                requestedAt: { [Op.gte]: thirtyDaysAgo },
                userId: { [Op.ne]: null }
            },
            include: [{ model: User, as: 'user', attributes: ['username'] }],
            attributes: [
                'userId',
                [sequelize.fn('COUNT', sequelize.col('CalendarAccess.id')), 'count'],
                [sequelize.fn('MAX', sequelize.col('requestedAt')), 'lastAccess']
            ],
            group: ['userId', 'user.id'],
            order: [[sequelize.literal('count'), 'DESC']]
        });

        const guestRequests = await CalendarAccess.findAll({
            where: {
                requestedAt: { [Op.gte]: thirtyDaysAgo },
                userId: null
            },
            attributes: [
                'ipAddress',
                'userAgent',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('MAX', sequelize.col('requestedAt')), 'lastAccess']
            ],
            group: ['ipAddress', 'userAgent'],
            order: [[sequelize.literal('count'), 'DESC']],
            limit: 50
        });

        const uniqueUsersCount = await CalendarAccess.count({
            distinct: true,
            col: 'userId',
            where: {
                requestedAt: { [Op.gte]: thirtyDaysAgo },
                userId: { [Op.ne]: null }
            }
        });

        const uniqueGuestsCount = await CalendarAccess.count({
            distinct: true,
            col: 'ipAddress',
            where: {
                requestedAt: { [Op.gte]: thirtyDaysAgo },
                userId: null
            }
        });

        res.json({
            totalRequests,
            userRequests,
            guestRequests,
            uniqueUsersCount,
            uniqueGuestsCount
        });
    } catch (error) {
        console.error('Error getting calendar stats:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== File Explorer ====================
exports.getFileExplorer = (req, res) => {
    try {
        const folderPath = req.query.path ? path.join(PUBLIC_PATH, req.query.path) : PUBLIC_PATH;
        
        // Security: prevent path traversal
        const relative = path.relative(PUBLIC_PATH, folderPath);
        if (relative.startsWith('..')) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const files = fs.readdirSync(folderPath, { withFileTypes: true });
        const items = files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory(),
            path: path.relative(PUBLIC_PATH, path.join(folderPath, file.name)),
            size: !file.isDirectory() ? fs.statSync(path.join(folderPath, file.name)).size : null,
            extension: !file.isDirectory() ? path.extname(file.name).toLowerCase() : null
        })).sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return b.isDirectory - a.isDirectory;
            return a.name.localeCompare(b.name);
        });
        
        const currentPath = req.query.path || '';
        res.json({ items, currentPath });
    } catch (error) {
        console.error('File explorer error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.readFile = (req, res) => {
    try {
        const filePath = path.join(PUBLIC_PATH, req.query.path);
        
        // Security: prevent path traversal
        const relative = path.relative(PUBLIC_PATH, filePath);
        if (relative.startsWith('..')) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Is a directory' });
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content, path: req.query.path });
    } catch (error) {
        console.error('Read file error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.saveFile = (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        const fullPath = path.join(PUBLIC_PATH, filePath);
        
        // Security: prevent path traversal
        const relative = path.relative(PUBLIC_PATH, fullPath);
        if (relative.startsWith('..')) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        fs.writeFileSync(fullPath, content, 'utf-8');
        res.json({ success: true, message: 'Bestand succesvol opgeslagen' });
    } catch (error) {
        console.error('Save file error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteFile = (req, res) => {
    try {
        const { path: filePath } = req.body;
        const fullPath = path.join(PUBLIC_PATH, filePath);
        
        // Security: prevent path traversal
        const relative = path.relative(PUBLIC_PATH, fullPath);
        if (relative.startsWith('..')) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(fullPath);
        }
        res.json({ success: true, message: 'Bestand succesvol verwijderd' });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.downloadFile = (req, res) => {
    try {
        const filePath = path.join(PUBLIC_PATH, req.query.path);
        
        // Security: prevent path traversal
        const relative = path.relative(PUBLIC_PATH, filePath);
        if (relative.startsWith('..')) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Is a directory' });
        }
        
        res.download(filePath);
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== Database Viewer ====================
exports.getDatabaseTables = async (req, res) => {
    try {
        const tables = await sequelize.showAllSchemas({ logging: false });
        
        // Get Sequelize models
        const models = sequelize.models;
        const tableInfo = [];
        
        for (const [modelName, model] of Object.entries(models)) {
            tableInfo.push({
                name: model.tableName || modelName,
                modelName,
                columns: model.rawAttributes ? Object.keys(model.rawAttributes) : []
            });
        }
        
        res.json({ tables: tableInfo });
    } catch (error) {
        console.error('Get tables error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getTableData = async (req, res) => {
    try {
        const { tableName } = req.query;
        const model = Object.values(sequelize.models).find(m => m.tableName === tableName);
        
        if (!model) {
            return res.status(404).json({ error: 'Table not found' });
        }
        
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const { count, rows } = await model.findAndCountAll({
            limit,
            offset,
            raw: true
        });
        
        res.json({ data: rows, total: count, limit, offset });
    } catch (error) {
        console.error('Get table data error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateTableRecord = async (req, res) => {
    try {
        const { tableName, id, updates } = req.body;
        const model = Object.values(sequelize.models).find(m => m.tableName === tableName);
        
        if (!model) {
            return res.status(404).json({ error: 'Table not found' });
        }
        
        const record = await model.findByPk(id);
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        await record.update(updates);
        res.json({ success: true, message: 'Record succesvol bijgewerkt' });
    } catch (error) {
        console.error('Update record error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteTableRecord = async (req, res) => {
    try {
        const { tableName, id } = req.body;
        const model = Object.values(sequelize.models).find(m => m.tableName === tableName);
        
        if (!model) {
            return res.status(404).json({ error: 'Table not found' });
        }
        
        await model.destroy({ where: { id } });
        res.json({ success: true, message: 'Record succesvol verwijderd' });
    } catch (error) {
        console.error('Delete record error:', error);
        res.status(500).json({ error: error.message });
    }
};

const readRecentLogLines = (filePath, numLines = 100) => {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    return lines.slice(-numLines).join('\n');
};

const clearLocalLogFiles = () => {
    const logDir = path.join(__dirname, '..', 'logs');
    const stdoutPath = path.join(logDir, 'stdout.log');
    const stderrPath = path.join(logDir, 'stderr.log');
    try {
        fs.writeFileSync(stdoutPath, '');
        fs.writeFileSync(stderrPath, '');
    } catch (err) {
        console.error('Failed to clear local log files:', err);
        throw err;
    }
};

// ==================== PM2 Logs ====================
exports.getPM2Logs = (req, res) => {
    try {
        const numLines = parseInt(req.query.lines) || 100;
        
        // Try to get logs using pm2 jlist
        exec('pm2 jlist', (error, stdout, stderr) => {
            if (error) {
                // Fallback to local application logs when PM2 is not available
                const logDir = path.join(__dirname, '..', 'logs');
                const stdoutLog = readRecentLogLines(path.join(logDir, 'stdout.log'), numLines);
                const stderrLog = readRecentLogLines(path.join(logDir, 'stderr.log'), numLines);

                return res.json({
                    processes: {
                        app: {
                            name: 'Application',
                            pid: process.pid,
                            status: 'running',
                            stdout: stdoutLog,
                            stderr: stderrLog
                        }
                    },
                    message: 'PM2 is niet beschikbaar. Lokale applicatielogs worden weergegeven.'
                });
            }
            
            try {
                const processes = JSON.parse(stdout);
                const logsData = [];
                
                processes.forEach(proc => {
                    if (proc.pid !== 0 && proc.pm2_env && proc.pm2_env.pm_out_log_path) {
                        logsData.push({
                            name: proc.name,
                            pid: proc.pid,
                            status: proc.pm2_env.status,
                            logPath: proc.pm2_env.pm_out_log_path,
                            errPath: proc.pm2_env.pm_err_log_path
                        });
                    }
                });
                
                if (logsData.length === 0) {
                    const logDir = path.join(__dirname, '..', 'logs');
                    const stdoutLog = readRecentLogLines(path.join(logDir, 'stdout.log'), numLines);
                    const stderrLog = readRecentLogLines(path.join(logDir, 'stderr.log'), numLines);

                    return res.json({
                        processes: {
                            app: {
                                name: 'Application',
                                pid: process.pid,
                                status: 'running',
                                stdout: stdoutLog,
                                stderr: stderrLog
                            }
                        },
                        message: 'Geen PM2-processen gevonden. Lokale applicatielogs worden weergegeven.'
                    });
                }

                // Get latest logs for each process
                const logs = {};
                logsData.forEach(proc => {
                    try {
                        logs[proc.name] = {
                            pid: proc.pid,
                            status: proc.status,
                            stdout: '',
                            stderr: ''
                        };

                        if (fs.existsSync(proc.logPath)) {
                            const content = fs.readFileSync(proc.logPath, 'utf-8');
                            const lines = content.split('\n').slice(-numLines);
                            logs[proc.name].stdout = lines.join('\n');
                        }

                        if (fs.existsSync(proc.errPath)) {
                            const content = fs.readFileSync(proc.errPath, 'utf-8');
                            const lines = content.split('\n').slice(-numLines);
                            logs[proc.name].stderr = lines.join('\n');
                        }
                    } catch (e) {
                        logs[proc.name] = { error: e.message };
                    }
                });
                
                res.json({ processes: logs, timestamp: new Date().toISOString() });
            } catch (parseError) {
                res.status(500).json({ error: 'Failed to parse PM2 output' });
            }
        });
    } catch (error) {
        console.error('PM2 logs error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.clearPM2Logs = (req, res) => {
    try {
        exec('pm2 flush', (error, stdout, stderr) => {
            if (error) {
                try {
                    clearLocalLogFiles();
                    return res.json({ success: true, message: 'Lokale logs succesvol gewist.' });
                } catch (logError) {
                    console.error('Failed to clear local logs:', logError);
                    return res.status(500).json({ error: 'Kon lokale logs niet wissen: ' + logError.message });
                }
            }
            res.json({ success: true, message: 'PM2 logs succesvol gewist.' });
        });
    } catch (error) {
        console.error('Clear PM2 logs error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== Notifications ====================
exports.getNotificationTest = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email'],
            where: { isActive: true },
            raw: true
        });
        
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.sendTestNotification = async (req, res) => {
    try {
        const { userId, title, body, tag, sendMethod } = req.body;
        
        if (!userId || !title || !body) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!sendMethod || !['notification', 'email', 'both'].includes(sendMethod)) {
            return res.status(400).json({ error: 'Invalid sendMethod' });
        }
        
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const messageData = {
            title,
            body,
            tag: tag || 'test',
            icon: '/img/logo.png',
            badge: '/img/badge.png',
            url: '/'
        };
        
        let sentToChannels = [];
        let errors = [];
        
        // Send push notification
        if (sendMethod === 'notification' || sendMethod === 'both') {
            const subscriptions = user.pushSubscriptions || [];
            if (subscriptions.length > 0) {
                try {
                    await NotificationService.sendIndividualNotification(userId, messageData);
                    sentToChannels.push('push notification');
                } catch (pushError) {
                    console.error('Push notification error:', pushError);
                    errors.push('Push notification: ' + pushError.message);
                }
            } else if (sendMethod === 'notification') {
                errors.push('Gebruiker heeft geen push subscriptions');
            }
        }
        
        // Send email
        if (sendMethod === 'email' || sendMethod === 'both') {
            if (!user.email) {
                errors.push('Gebruiker heeft geen email adres');
            } else {
                try {
                    const { sendMail } = require('../config/mailer');
                    await sendMail({
                        to: user.email,
                        subject: `📢 ${title}`,
                        text: `${title}: ${body}`,
                        html: `
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
                                    .footer { background-color: #333333; color: #cccccc; padding: 20px; text-align: center; font-size: 12px; }
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
                                            <div class="notification-title">${title}</div>
                                            <p style="margin-bottom: 0;">${body}</p>
                                        </div>
                                    </div>
                                    <div class="footer">
                                        <p>&copy; ${new Date().getFullYear()} Chiro Vreugdeland Meeuwen</p>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `
                    });
                    sentToChannels.push('email');
                } catch (emailError) {
                    console.error('Email send error:', emailError);
                    errors.push('Email: ' + emailError.message);
                }
            }
        }
        
        if (sentToChannels.length === 0 && errors.length > 0) {
            return res.status(400).json({ 
                success: false,
                error: errors.join('; ')
            });
        }
        
        let message = `Succesvol verstuurd naar: ${sentToChannels.join(', ')}`;
        if (errors.length > 0) {
            message += `. Fouten: ${errors.join('; ')}`;
        }
        
        res.json({
            success: true,
            message: message
        });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: error.message });
    }
}// ==================== Backup Management ====================
const isValidBackupName = (name) => {
    return typeof name === 'string' && /^[a-zA-Z0-9._-]+$/.test(name);
};

exports.getBackups = (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Geen toegang' });
        }

        const backupDir = path.join(__dirname, '..', 'backups');
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const files = fs.readdirSync(backupDir, { withFileTypes: true });
        const backups = files
            .filter(file => file.isDirectory())
            .map(file => {
                try {
                    const fullPath = path.join(backupDir, file.name);
                    const stat = fs.statSync(fullPath);
                    return {
                        name: file.name,
                        created: stat.birthtime,
                        path: file.name
                    };
                } catch (e) {
                    console.error(`Error reading backup folder ${file.name}:`, e);
                    return null;
                }
            })
            .filter(b => b !== null)
            .sort((a, b) => b.created - a.created);
            
        res.json({ backups });
    } catch (error) {
        console.error('Get backups error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.createBackup = (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Geen toegang' });
        }

        const scriptPath = path.join(__dirname, '..', 'scripts', 'backup.js');
        
        exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Backup creation failed:', error);
                return res.status(500).json({ error: 'Backup maken mislukt: ' + error.message });
            }
            res.json({ success: true, message: 'Backup succesvol aangemaakt', output: stdout });
        });
    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteBackup = (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Geen toegang' });
        }

        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Backup naam ontbreekt' });
        
        // Security: validate name is just a folder name, not path traversal or shell injection
        if (!isValidBackupName(name)) {
            return res.status(403).json({ error: 'Ongeldige backup naam' });
        }
        
        const backupPath = path.join(__dirname, '..', 'backups', name);
        
        if (fs.existsSync(backupPath)) {
            fs.rmSync(backupPath, { recursive: true, force: true });
            res.json({ success: true, message: 'Backup verwijderd' });
        } else {
            res.status(404).json({ error: 'Backup niet gevonden' });
        }
    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getBackupContent = (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Geen toegang' });
        }

        const { name } = req.query;
        if (!name) return res.status(400).json({ error: 'Backup naam ontbreekt' });

        // Security check
        if (!isValidBackupName(name)) {
            return res.status(403).json({ error: 'Ongeldige backup naam' });
        }

        const backupPath = path.join(__dirname, '..', 'backups', name);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup niet gevonden' });
        }

        const getFiles = (dir, relativeDir = '') => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const files = [];

            for (const entry of entries) {
                const relativePath = path.join(relativeDir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...getFiles(path.join(dir, entry.name), relativePath));
                } else {
                    const stats = fs.statSync(path.join(dir, entry.name));
                    files.push({
                        path: relativePath,
                        size: stats.size
                    });
                }
            }
            return files;
        };

        const contents = getFiles(backupPath);
        res.json({ contents });
    } catch (error) {
        console.error('Get backup content error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.restoreBackup = async (req, res) => {
    try {
        const { name, password } = req.body;
        
        // Only an 'admin' role user is allowed to restore backups
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Alleen beheerder(s) kunnen backups herstellen.' });
        }

        if (!name) return res.status(400).json({ error: 'Backup naam ontbreekt' });
        if (!password) return res.status(400).json({ error: 'Wachtwoord ontbreekt' });

        // Verify password
        const isMatch = await req.user.validatePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Fout wachtwoord' });
        }

        // Security check
        if (!isValidBackupName(name)) {
            return res.status(403).json({ error: 'Ongeldige backup naam' });
        }

        const backupPath = path.join(__dirname, '..', 'backups', name);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup niet gevonden' });
        }

        const rootDir = path.join(__dirname, '..');
        const dbFile = path.join(rootDir, 'database.sqlite');
        const uploadsDir = path.join(rootDir, 'public', 'uploads');
        const feedUploadsDir = path.join(rootDir, 'public', 'feed_uploads');
        const gameUploadsDir = path.join(rootDir, 'public', 'game_uploads');

        const emptyDirectory = (dir) => {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir)) {
                const entryPath = path.join(dir, entry);
                try {
                    const stats = fs.lstatSync(entryPath);
                    if (stats.isDirectory()) {
                        fs.rmSync(entryPath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(entryPath);
                    }
                } catch (unlinkErr) {
                    console.error(`Warning: Could not remove ${entryPath} during restore cleanup:`, unlinkErr.message);
                }
            }
        };

        const copyDirectoryRobust = (src, dest) => {
            if (!fs.existsSync(src)) return;
            fs.mkdirSync(dest, { recursive: true });
            const entries = fs.readdirSync(src, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                if (entry.isDirectory()) {
                    copyDirectoryRobust(srcPath, destPath);
                } else {
                    try {
                        fs.copyFileSync(srcPath, destPath);
                    } catch (copyErr) {
                        console.error(`Warning: Could not copy ${srcPath} to ${destPath}:`, copyErr.message);
                    }
                }
            }
        };
        
        // Restore Database
        // We must drain and destroy all pool connections before replacing the SQLite file
        // on disk, otherwise existing connections keep stale file handles and the app
        // enters a broken / inconsistent state.
        //
        // IMPORTANT: We do NOT use sequelize.close() because that method permanently
        // replaces the instance-level getConnection() with a throwing stub and there
        // is no official API to re-open it. Instead we:
        //   1. Drain the pool  (wait for in-flight queries to finish)
        //   2. DestroyAllNow   (close every idle socket)
        //   3. Copy the backup file
        //   4. Re-initialize the pool via initPools()  (new pool, original prototype
        //      getConnection() is unaffected because we never called close())
        const backupDb = path.join(backupPath, 'database.sqlite');
        if (fs.existsSync(backupDb)) {
            try {
                console.log('Draining database connection pool for restore...');
                await sequelize.connectionManager.pool.drain();
                await sequelize.connectionManager.pool.destroyAllNow();
                console.log('Database connection pool drained and destroyed.');
            } catch (drainErr) {
                console.error('Warning: Error draining connection pool:', drainErr.message);
            }

            try {
                fs.copyFileSync(backupDb, dbFile);
                // Also remove any leftover WAL / SHM journal files from the old database
                // so they do not corrupt the freshly restored file.
                const walFile = dbFile + '-wal';
                const shmFile = dbFile + '-shm';
                if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
                if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
                console.log('Database file restored.');
            } catch (dbErr) {
                console.error('Error copying backup database file:', dbErr);
            }

            // Re-initialize the pool so the app can make new connections to the
            // freshly restored database file.
            try {
                sequelize.connectionManager.initPools();
                console.log('Database connection pool re-initialized after restore.');
            } catch (reinitErr) {
                console.error('Error re-initializing connection pool after restore:', reinitErr);
            }
        }

        // Restore Sessions (explicitly skipped to keep active admin session & CSRF token alive)
        // Overwriting sessions.sqlite would immediately log out the admin doing the restore
        // and invalidate their CSRF token.

        // Sync database schema to ensure any new model columns exist in the restored DB
        try {
            const { syncDatabase } = require('../models');
            await syncDatabase();
            console.log('Database synced after restore.');
        } catch (syncError) {
            console.error('Error syncing database after restore:', syncError);
        }

        // Restore Uploads
        try {
            const backupUploads = path.join(backupPath, 'uploads');
            if (fs.existsSync(backupUploads)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
                emptyDirectory(uploadsDir);
                copyDirectoryRobust(backupUploads, uploadsDir);
            }
        } catch (uploadsErr) {
            console.error('Error restoring uploads folder:', uploadsErr);
        }

        // Restore Feed Uploads
        try {
            const backupFeedUploads = path.join(backupPath, 'feed_uploads');
            if (fs.existsSync(backupFeedUploads)) {
                fs.mkdirSync(feedUploadsDir, { recursive: true });
                emptyDirectory(feedUploadsDir);
                copyDirectoryRobust(backupFeedUploads, feedUploadsDir);
            }
        } catch (feedUploadsErr) {
            console.error('Error restoring feed uploads folder:', feedUploadsErr);
        }

        // Restore Game Uploads
        try {
            const backupGameUploads = path.join(backupPath, 'game_uploads');
            if (fs.existsSync(backupGameUploads)) {
                fs.mkdirSync(gameUploadsDir, { recursive: true });
                emptyDirectory(gameUploadsDir);
                copyDirectoryRobust(backupGameUploads, gameUploadsDir);
            }
        } catch (gameUploadsErr) {
            console.error('Error restoring game uploads folder:', gameUploadsErr);
        }

        res.json({ success: true, message: 'Backup succesvol teruggezet. De site is hersteld naar de geselecteerde staat.' });

    } catch (error) {
        console.error('Restore backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.downloadBackup = (req, res) => {
    try {
        const { name } = req.query;
        
        // Only an 'admin' role user is allowed to download backups
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Geen toegang' });
        }

        if (!name) return res.status(400).json({ error: 'Backup naam ontbreekt' });

        if (!isValidBackupName(name)) {
            return res.status(403).json({ error: 'Ongeldige backup naam' });
        }

        const backupDir = path.join(__dirname, '..', 'backups');
        const sourcePath = path.join(backupDir, name);
        const zipFile = `${name}.zip`;
        const zipPath = path.join(backupDir, zipFile);

        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ error: 'Backup niet gevonden' });
        }

        // Create zip
        exec(`cd "${backupDir}" && zip -r "${zipFile}" "${name}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Zip failed:', error);
                return res.status(500).json({ error: 'Inpakken mislukt: ' + error.message });
            }

            res.download(zipPath, `${name}.back`, (err) => {
                if (err) console.error('Download error:', err);
                // Clean up zip file after download
                if (fs.existsSync(zipPath)) {
                    fs.unlinkSync(zipPath);
                }
            });
        });
    } catch (error) {
        console.error('Download backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.uploadBackup = async (req, res) => {
    try {
        const { password } = req.body;
        
        // Only an 'admin' role user is allowed to upload backups
        if (req.user.role !== 'admin') {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: 'Alleen een beheerder kan backups uploaden.' });
        }

        if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });
        if (!password) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Wachtwoord ontbreekt' });
        }

        // Verify password
        const isMatch = await req.user.validatePassword(password);
        if (!isMatch) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(401).json({ error: 'Fout wachtwoord' });
        }

        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        const uploadedPath = req.file.path;
        const extractTimestamp = Date.now();
        const tempZipPath = path.join(backupDir, `upload-${extractTimestamp}.zip`);
        // We extract into a uniquely-named temp folder so we can reliably find the
        // backup folder inside it regardless of how many backups already exist.
        const tempExtractDir = path.join(backupDir, `temp-extract-${extractTimestamp}`);

        // Move uploaded file to backups dir as a .zip
        fs.renameSync(uploadedPath, tempZipPath);

        // Extract into the isolated temp folder
        exec(`unzip -o "${tempZipPath}" -d "${tempExtractDir}"`, async (error, stdout, stderr) => {
            // Always clean up the zip file
            if (fs.existsSync(tempZipPath)) {
                try { fs.unlinkSync(tempZipPath); } catch (e) { /* ignore */ }
            }

            if (error) {
                console.error('Unzip failed:', error);
                // Clean up temp extract dir too
                if (fs.existsSync(tempExtractDir)) {
                    try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
                }
                return res.status(500).json({ error: 'Uitpakken mislukt: ' + error.message });
            }

            // The zip was created with: zip -r "backup-name" "backup-name"
            // so the extracted structure is: tempExtractDir/backup-name/{database.sqlite, uploads/, ...}
            // Find the backup folder inside the temp extract dir.
            let backupFolderName = null;
            try {
                const entries = fs.readdirSync(tempExtractDir, { withFileTypes: true })
                    .filter(d => d.isDirectory());

                // Prefer a folder that contains database.sqlite (definitive backup marker)
                for (const entry of entries) {
                    const candidateDb = path.join(tempExtractDir, entry.name, 'database.sqlite');
                    if (fs.existsSync(candidateDb)) {
                        backupFolderName = entry.name;
                        break;
                    }
                }

                // Fallback: just use the first directory found
                if (!backupFolderName && entries.length > 0) {
                    backupFolderName = entries[0].name;
                }
            } catch (readErr) {
                console.error('Error reading extracted backup folder:', readErr);
            }

            if (!backupFolderName) {
                if (fs.existsSync(tempExtractDir)) {
                    try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
                }
                return res.status(500).json({ error: 'Geen geldige backup folder gevonden in het geüploade bestand' });
            }

            const extractedBackupPath = path.join(tempExtractDir, backupFolderName);

            // Move the backup folder out of the temp dir and into the proper backups directory.
            // If a backup with the same name already exists, append a timestamp to avoid collision.
            let finalBackupName = backupFolderName;
            let finalBackupPath = path.join(backupDir, finalBackupName);
            if (fs.existsSync(finalBackupPath)) {
                finalBackupName = `${backupFolderName}-restored-${extractTimestamp}`;
                finalBackupPath = path.join(backupDir, finalBackupName);
            }

            try {
                fs.renameSync(extractedBackupPath, finalBackupPath);
            } catch (moveErr) {
                console.error('Error moving extracted backup to final location:', moveErr);
                if (fs.existsSync(tempExtractDir)) {
                    try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
                }
                return res.status(500).json({ error: 'Kon backup niet verplaatsen: ' + moveErr.message });
            }

            // Clean up the now-empty temp extract dir
            if (fs.existsSync(tempExtractDir)) {
                try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
            }

            // Trigger restore using the known backup folder name
            req.body.name = finalBackupName;
            return exports.restoreBackup(req, res);
        });

    } catch (error) {
        console.error('Upload backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== Main View ====================
exports.getMaintenanceTools = async (req, res) => {
    try {
        // Check if user is admin with username 'admin'
        if (req.user.username !== 'admin' || req.user.role !== 'admin') {
            return res.redirect('/');
        }
        
        const { Announcement, SurveyResponse } = require('../models');
        const announcements = await Announcement.findAll({
            include: [
                { model: User, as: 'creator', attributes: ['id', 'username'] },
                { 
                    model: SurveyResponse, 
                    as: 'surveyResponses',
                    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        
        res.render('admin/maintenance', { 
            title: 'Onderhoudstools',
            user: req.user,
            announcements
        });
    } catch (error) {
        console.error('Maintenance tools error:', error);
        res.status(500).render('error', {
            title: 'Fout',
            message: 'Er ging iets mis',
            user: req.user
        });
    }
};

exports.getBackupTool = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.redirect('/');
        }
        
        res.render('admin/backups', { 
            title: 'Backup Beheer',
            user: req.user 
        });
    } catch (error) {
        console.error('Backup tool error:', error);
        res.status(500).render('error', {
            title: 'Fout',
            message: 'Er ging iets mis',
            user: req.user
        });
    }
};
