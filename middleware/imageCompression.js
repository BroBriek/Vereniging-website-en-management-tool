const ImageService = require('../services/ImageService');

/**
 * Middleware to compress uploaded images.
 * @param {Object} options - Compression options.
 */
const compressImage = (options = {}) => async (req, res, next) => {
    if (!req.file && (!req.files || req.files.length === 0)) {
        return next();
    }

    try {
        if (req.file) {
            if (req.file.mimetype.startsWith('image/')) {
                await ImageService.compressFile(req.file.path, options);
            }
        }

        if (req.files && Array.isArray(req.files)) {
            await Promise.all(req.files.map(async (file) => {
                if (file.mimetype.startsWith('image/')) {
                    await ImageService.compressFile(file.path, options);
                }
            }));
        }

        next();
    } catch (err) {
        console.error('Image compression error:', err);
        // We continue anyway, so the upload doesn't fail if compression fails
        next();
    }
};

module.exports = {
    compressProfilePicture: compressImage({ width: 400, height: 400, quality: 80 }),
    compressFeedImage: compressImage({ width: 1200, quality: 75 }),
    compressGenericImage: compressImage({ width: 1200, quality: 80 })
};
