const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const uploadController = require('../controllers/uploadController');
const maintenanceController = require('../controllers/maintenanceController');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(ensureAuthenticated);
router.use(ensureAdmin);

router.get('/', adminController.getDashboard);
router.get('/info', adminController.getInfo);

// Maintenance Tools (restricted to admin user only)
router.get('/maintenance', maintenanceController.getMaintenanceTools);
router.get('/api/file-explorer', maintenanceController.getFileExplorer);
router.get('/api/file-read', maintenanceController.readFile);
router.post('/api/file-save', maintenanceController.saveFile);
router.post('/api/file-delete', maintenanceController.deleteFile);
router.get('/api/file-download/:path(.*)', maintenanceController.downloadFile);
router.get('/api/db-tables', maintenanceController.getDatabaseTables);
router.get('/api/db-data', maintenanceController.getTableData);
router.post('/api/db-update', maintenanceController.updateTableRecord);
router.post('/api/db-delete', maintenanceController.deleteTableRecord);
router.get('/api/pm2-logs', maintenanceController.getPM2Logs);
router.get('/api/notification-users', maintenanceController.getNotificationTest);
router.post('/api/notification-send', maintenanceController.sendTestNotification);

// Email Tool
router.get('/email', adminController.getEmailTool);
router.post('/email/send', adminController.postSendEmail);

// User Management
router.get('/users', adminController.getUsers);
router.post('/users', adminController.postUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/users/:id/edit', adminController.getEditUser);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/toggle-status', adminController.toggleUserStatus);

// Upload Manager
router.get('/uploads', uploadController.getUploads);
router.post('/uploads', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.redirect('/admin/uploads?error=' + encodeURIComponent(err.message));
        }
        next();
    });
}, uploadController.postUpload);
router.delete('/uploads/:filename', uploadController.deleteUpload);
router.post('/api/upload-image', upload.single('image'), uploadController.uploadImageApi);

// Registrations
router.get('/registrations', adminController.getRegistrations);
router.get('/registrations/export', adminController.exportRegistrationsExcel);
router.get('/registrations/export-pdf', adminController.exportRegistrationsPDF);
router.post('/registrations/new-period', adminController.startNewPeriod);
router.delete('/registrations/:id', adminController.deleteRegistration);

// Danger Zone
router.post('/danger/reset-registrations', adminController.resetRegistrations);
router.post('/danger/reset-website', adminController.resetWebsite);
router.post('/danger/backup', adminController.triggerBackup);
router.get('/danger/test-push', adminController.testPush);

// Page Content Editors
router.get('/page/:page', adminController.getEditPage);
router.post('/page/:page', upload.single('image'), adminController.postEditPage);

// Leader CRUD
router.get('/leaders', adminController.getLeaders);
router.post('/leaders', upload.single('image'), adminController.postLeader);
router.get('/leaders/:id/edit', adminController.getEditLeader);
router.put('/leaders/:id', upload.single('image'), adminController.updateLeader);
router.delete('/leaders/:id', adminController.deleteLeader);

const financeController = require('../controllers/financeController');

// Existing Event CRUD
router.get('/events', adminController.getEvents);
router.post('/events', adminController.postEvent);
router.delete('/events/:id', adminController.deleteEvent);

// --- Finance Tool ---
router.get('/finance', financeController.getIndex); // Root
router.get('/finance/info', financeController.getInfo); // Info/Help Page
router.get('/finance/:folderId', financeController.getIndex); // Subfolder
router.post('/finance', financeController.postItem); // Create in Root
router.post('/finance/:folderId', financeController.postItem); // Create in Subfolder
router.put('/finance/item/:id', financeController.updateItem); // Update Item
router.delete('/finance/item/:id', financeController.deleteItem);
router.get('/finance/:folderId/export', financeController.exportFolder);
// Route to export root? (Optional, let's map it to '0' or handle in controller)
router.get('/finance/export/root', financeController.exportFolder);

// Leidingshoekjes beheer
router.get('/feedgroups', adminController.getFeedGroups);
router.post('/feedgroups', adminController.postFeedGroup);
router.put('/feedgroups/:id', adminController.updateFeedGroup);
router.delete('/feedgroups/:id', adminController.deleteFeedGroup);

module.exports = router;
