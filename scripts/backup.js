const fs = require('fs');
const path = require('path');

// Define paths
const rootDir = path.join(__dirname, '..');
const backupRootDir = path.join(rootDir, 'backups');
const uploadsDir = path.join(rootDir, 'public/uploads');
const feedUploadsDir = path.join(rootDir, 'public/feed_uploads');
const dbFile = path.join(rootDir, 'database.sqlite');
const sessionFile = path.join(rootDir, 'sessions.sqlite');

// Create backup root if not exists
if (!fs.existsSync(backupRootDir)) {
    fs.mkdirSync(backupRootDir);
}

// Generate timestamped folder name
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DD-THH-mm-ss
const targetDir = path.join(backupRootDir, `backup-${timestamp}`);

fs.mkdirSync(targetDir);

console.log(`Starting backup to: ${targetDir}`);

// 1. Backup Database
if (fs.existsSync(dbFile)) {
    fs.copyFileSync(dbFile, path.join(targetDir, 'database.sqlite'));
    console.log('✅ Database backed up.');
} else {
    console.log('⚠️ Database file not found (skipping).');
}

// 2. Backup Sessions (Optional)
if (fs.existsSync(sessionFile)) {
    fs.copyFileSync(sessionFile, path.join(targetDir, 'sessions.sqlite'));
    console.log('✅ Sessions backed up.');
}

// 3. Backup Uploads
const targetUploadsDir = path.join(targetDir, 'uploads');
if (fs.existsSync(uploadsDir)) {
    // Use fs.cpSync (Node v16.7+) for recursive copy
    try {
        fs.cpSync(uploadsDir, targetUploadsDir, { recursive: true });
        console.log('✅ Uploads folder backed up.');
    } catch (err) {
        console.error('❌ Error backing up uploads:', err.message);
    }
} else {
    console.log('⚠️ Uploads folder not found (skipping).');
}

// 4. Backup Feed Uploads
const targetFeedUploadsDir = path.join(targetDir, 'feed_uploads');
if (fs.existsSync(feedUploadsDir)) {
    try {
        fs.cpSync(feedUploadsDir, targetFeedUploadsDir, { recursive: true });
        console.log('✅ Feed Uploads folder backed up.');
    } catch (err) {
        console.error('❌ Error backing up feed uploads:', err.message);
    }
} else {
    console.log('⚠️ Feed Uploads folder not found (skipping).');
}

// 5. Backup Game Uploads
const gameUploadsDir = path.join(rootDir, 'public/game_uploads');
const targetGameUploadsDir = path.join(targetDir, 'game_uploads');
if (fs.existsSync(gameUploadsDir)) {
    try {
        fs.cpSync(gameUploadsDir, targetGameUploadsDir, { recursive: true });
        console.log('✅ Game Uploads folder backed up.');
    } catch (err) {
        console.error('❌ Error backing up game uploads:', err.message);
    }
} else {
    console.log('⚠️ Game Uploads folder not found (skipping).');
}

console.log('\n🎉 Backup completed successfully!');
