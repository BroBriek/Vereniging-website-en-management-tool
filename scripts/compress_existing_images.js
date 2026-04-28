const fs = require('fs');
const path = require('path');
const ImageService = require('../services/ImageService');

const TARGET_DIRS = [
    { path: 'public/uploads/profiles', options: { width: 400, height: 400, quality: 80 } },
    { path: 'public/uploads', options: { width: 1200, quality: 80 } },
    { path: 'public/feed_uploads', options: { width: 1200, quality: 75 } },
    { path: 'public/game_uploads', options: { width: 1200, quality: 80 } }
];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

async function compressDirectory(dirPath, options) {
    const absoluteDirPath = path.resolve(__dirname, '..', dirPath);
    if (!fs.existsSync(absoluteDirPath)) {
        console.log(`Directory ${dirPath} does not exist, skipping...`);
        return;
    }

    const files = fs.readdirSync(absoluteDirPath);
    console.log(`Processing ${files.length} files in ${dirPath}...`);

    for (const file of files) {
        const filePath = path.join(absoluteDirPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile() && IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
            const originalSize = stats.size;
            try {
                console.log(`Compressing ${file} (${(originalSize / 1024).toFixed(2)} KB)...`);
                await ImageService.compressFile(filePath, options);
                const newSize = fs.statSync(filePath).size;
                const savings = ((originalSize - newSize) / originalSize * 100).toFixed(2);
                console.log(`  Done! New size: ${(newSize / 1024).toFixed(2)} KB (Saved ${savings}%)`);
            } catch (err) {
                console.error(`  Error compressing ${file}:`, err.message);
            }
        } else if (stats.isDirectory() && dirPath === 'public/uploads' && file === 'profiles') {
            // Already handled profiles separately
            continue;
        } else if (stats.isDirectory()) {
            // Recursively handle subdirectories if any (optional)
            // For now, let's keep it simple as the structure is mostly flat
        }
    }
}

async function run() {
    console.log('Starting batch image compression...');
    for (const target of TARGET_DIRS) {
        await compressDirectory(target.path, target.options);
    }
    console.log('Batch compression finished!');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
