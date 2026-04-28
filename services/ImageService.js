const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class ImageService {
    /**
     * Compress an image from a buffer and save it to a destination.
     * @param {Buffer} buffer - The image buffer.
     * @param {string} destination - The destination path.
     * @param {Object} options - Compression options.
     * @param {number} options.width - Max width.
     * @param {number} options.height - Max height.
     * @param {number} options.quality - Quality (1-100).
     */
    static async compressAndSave(buffer, destination, options = {}) {
        const { width, height, quality = 80 } = options;
        
        let pipeline = sharp(buffer);
        
        if (width || height) {
            pipeline = pipeline.resize(width, height, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // We'll convert to the same format but optimized, or WebP.
        // For now, let's stick to the original format's optimization or convert to JPEG/WebP.
        // Let's use JPEG for compatibility or WebP if preferred.
        // Actually, sharp can detect format. Let's force a format for better control.
        
        const ext = path.extname(destination).toLowerCase();
        
        if (ext === '.jpg' || ext === '.jpeg') {
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        } else if (ext === '.png') {
            pipeline = pipeline.png({ quality, palette: true });
        } else if (ext === '.webp') {
            pipeline = pipeline.webp({ quality });
        } else {
            // Default to jpeg if unknown
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        }

        await pipeline.toFile(destination);
    }

    /**
     * Compress an existing file.
     * @param {string} filePath - Path to the file.
     * @param {Object} options - Compression options.
     */
    static async compressFile(filePath, options = {}) {
        const tempPath = filePath + '.tmp';
        const buffer = await fs.promises.readFile(filePath);
        await this.compressAndSave(buffer, tempPath, options);
        await fs.promises.rename(tempPath, filePath);
    }
}

module.exports = ImageService;
