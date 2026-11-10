const fs = require('fs');
const path = require('path');

exports.getUploads = (req, res) => {
    if (req.query.picker !== 'true') {
        return res.redirect('/admin/maintenance?tab=uploads');
    }

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
            success: req.query.success,
            isStandalone: true
        });
    });
};

exports.postUpload = (req, res) => {
    const isPicker = req.query.picker === 'true';
    const baseRedirect = isPicker ? '/admin/uploads?picker=true&' : '/admin/maintenance?tab=uploads&';
    if (!req.file) {
        return res.redirect(baseRedirect + 'error=' + encodeURIComponent('Geen bestand geselecteerd.'));
    }
    res.redirect(baseRedirect + 'success=' + encodeURIComponent('Bestand succesvol geüpload!'));
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
        const isPicker = req.query.picker === 'true';
        res.redirect(isPicker ? '/admin/uploads?picker=true' : '/admin/maintenance?tab=uploads&success=' + encodeURIComponent('Bestand verwijderd!'));
    });
};

exports.uploadImageApi = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Geen afbeelding geüpload' });
    }
    // Return the URL for the editor
    res.json({ 
        url: `/uploads/${req.file.filename}` 
    });
};
