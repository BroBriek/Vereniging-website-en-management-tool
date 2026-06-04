const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = 'public/uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
    const allowedExts = /^(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|tar|gz|json|sqlite|db)$/i;
    const ext = path.extname(file.originalname).substring(1);
    if (!allowedExts.test(ext)) {
        return cb(new Error('Ongeldig bestandstype. Dit type bestand is niet toegestaan om veiligheidsredenen.'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: fileFilter
});

module.exports = upload;
