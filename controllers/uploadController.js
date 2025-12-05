const fs = require('fs');
const path = require('path');

exports.getUploads = (req, res) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server Error');
        }

        // Filter for files only (optional) and maybe sort by date
        const fileList = files.filter(file => {
            return fs.statSync(path.join(uploadDir, file)).isFile();
        });

        res.render('admin/uploads', { 
            title: 'Bestandsbeheer', 
            files: fileList, 
            user: req.user,
            error: req.query.error,
            success: req.query.success
        });
    });
};

exports.postUpload = (req, res) => {
    if (!req.file) {
        return res.redirect('/admin/uploads?error=' + encodeURIComponent('Geen bestand geselecteerd.'));
    }
    res.redirect('/admin/uploads?success=' + encodeURIComponent('Bestand succesvol geüpload!'));
};

exports.deleteUpload = (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../public/uploads', filename);

    // Basic security check to prevent directory traversal
    if (filename.includes('..')) {
        return res.status(400).send('Invalid filename');
    }

    fs.unlink(filepath, (err) => {
        if (err) {
            console.error(err);
            // Don't crash if file doesn't exist, just redirect
        }
        res.redirect('/admin/uploads');
    });
};
