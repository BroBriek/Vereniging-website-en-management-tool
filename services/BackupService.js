const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cron = require('node-cron');

class BackupService {
    constructor() {
        this.backupRootDir = path.join(__dirname, '..', 'backups');
        this.maxBackups = 5;
    }

    // Perform a backup by running the backup script
    async performBackup() {
        return new Promise((resolve, reject) => {
            const backupScript = path.join(__dirname, '..', 'scripts', 'backup.js');
            exec(`node ${backupScript}`, (error, stdout, stderr) => {
                if (error) {
                    console.error('Backup failed:', error);
                    reject(error);
                } else {
                    console.log('Backup completed:', stdout);
                    this.cleanupBackups();
                    resolve(stdout);
                }
            });
        });
    }

    // Clean up old backups, keeping only the latest 5
    cleanupBackups() {
        if (!fs.existsSync(this.backupRootDir)) {
            return;
        }

        const backups = fs.readdirSync(this.backupRootDir)
            .filter(dir => dir.startsWith('backup-'))
            .map(dir => ({
                name: dir,
                path: path.join(this.backupRootDir, dir),
                date: new Date(dir.replace('backup-', '').replace(/-/g, ':').replace('T', ' '))
            }))
            .sort((a, b) => b.date - a.date); // Sort by date descending (newest first)

        if (backups.length > this.maxBackups) {
            const toDelete = backups.slice(this.maxBackups);
            toDelete.forEach(backup => {
                try {
                    fs.rmSync(backup.path, { recursive: true, force: true });
                    console.log(`Deleted old backup: ${backup.name}`);
                } catch (err) {
                    console.error(`Failed to delete backup ${backup.name}:`, err);
                }
            });
        }
    }

    // Schedule monthly backup on the 1st of each month at 2 AM
    scheduleMonthlyBackup() {
        cron.schedule('0 2 1 * *', async () => {
            console.log('Starting scheduled monthly backup...');
            try {
                await this.performBackup();
                console.log('Scheduled monthly backup completed.');
            } catch (error) {
                console.error('Scheduled monthly backup failed:', error);
            }
        });
        console.log('Monthly backup scheduled for the 1st of each month at 2 AM.');
    }
}

module.exports = BackupService;