const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directory exists
const uploadDir = 'public/feed_uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /pdf|doc|docx|txt/;
        // Check mime
        const mimetype = filetypes.test(file.mimetype) || 
                         file.mimetype === 'application/msword' || 
                         file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                         file.mimetype === 'application/pdf' ||
                         file.mimetype === 'text/plain';
                         
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (extname) { // Mime type checking can be finicky with some browsers/OS, relying on extension + specific mimes
            return cb(null, true);
        }
        cb(new Error("Fout: Alleen documenten (PDF, Word) toegelaten!"));
      }
});

module.exports = upload;
