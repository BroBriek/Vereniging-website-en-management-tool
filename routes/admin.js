const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const uploadController = require('../controllers/uploadController');
const maintenanceController = require('../controllers/maintenanceController');
const formController = require('../controllers/formController');
const { ensureAuthenticated, ensureAdmin, ensureMedia } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { compressGenericImage } = require('../middleware/imageCompression');

router.use(ensureAuthenticated);

// Conditional Access for Registrations
const checkViewRegistrationsPermission = (req, res, next) => {
    if (req.user.role === 'admin' || process.env.ENABLE_PUBLIC_REGISTRATIONS_VIEW === 'true') {
        return next();
    }
    res.redirect('/');
};

router.get('/registrations', checkViewRegistrationsPermission, adminController.getRegistrations);
router.post('/registrations/toggle', ensureAdmin, adminController.postToggleRegistration);
router.get('/registrations/export', checkViewRegistrationsPermission, adminController.exportRegistrationsExcel);
router.get('/registrations/export-pdf', checkViewRegistrationsPermission, adminController.exportRegistrationsPDF);

// --- Routes accessible by both Admin and Media ---
router.get('/', ensureMedia, adminController.getDashboard);
router.get('/info', ensureMedia, adminController.getInfo);

// Page Content Editors
router.get('/page/:page', ensureMedia, adminController.getEditPage);
router.post('/page/:page', ensureMedia, upload.single('image'), compressGenericImage, adminController.postEditPage);

// Leader CRUD
router.get('/leaders', ensureMedia, adminController.getLeaders);
router.post('/leaders', ensureMedia, upload.single('image'), compressGenericImage, adminController.postLeader);
router.get('/leaders/:id/edit', ensureMedia, adminController.getEditLeader);
router.put('/leaders/:id', ensureMedia, upload.single('image'), compressGenericImage, adminController.updateLeader);
router.delete('/leaders/:id', ensureMedia, adminController.deleteLeader);

// Event CRUD
router.get('/events', ensureMedia, adminController.getEvents);
router.post('/events', ensureMedia, adminController.postEvent);
router.put('/events/:id', ensureMedia, adminController.updateEvent);
router.delete('/events/:id', ensureMedia, adminController.deleteEvent);

// Upload Manager
router.get('/uploads', ensureMedia, uploadController.getUploads);
router.post('/uploads', ensureMedia, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.redirect('/admin/uploads?error=' + encodeURIComponent(err.message));
        }
        next();
    });
}, compressGenericImage, uploadController.postUpload);
router.delete('/uploads/:filename', ensureMedia, uploadController.deleteUpload);
router.post('/api/upload-image', ensureMedia, upload.single('image'), compressGenericImage, uploadController.uploadImageApi);

// Form Builder
router.get('/forms', ensureMedia, formController.getForms);
router.get('/forms/create', ensureMedia, formController.getCreateForm);
router.post('/forms', ensureMedia, formController.postCreateForm);
router.get('/forms/:id/edit', ensureMedia, formController.getEditForm);
router.post('/forms/:id/edit', ensureMedia, formController.postEditForm);
router.post('/forms/:id/delete', ensureMedia, formController.postDeleteForm);
router.get('/forms/:id/responses', ensureMedia, formController.getResponses);
router.get('/forms/:id/responses/export', ensureMedia, formController.exportResponses);
router.get('/forms/:id/responses/export-eetdag', ensureMedia, formController.exportEetdagPDF);
router.put('/forms/responses/:id', ensureMedia, formController.updateResponse);
router.delete('/forms/responses/:id', ensureMedia, formController.deleteResponse);

// --- Routes ONLY for Admin ---
router.use(ensureAdmin);

// Maintenance Tools
router.get('/maintenance', maintenanceController.getMaintenanceTools);
router.get('/api/calendar-stats', maintenanceController.getCalendarStats);
router.get('/api/file-explorer', maintenanceController.getFileExplorer);
router.get('/api/file-read', maintenanceController.readFile);
router.post('/api/file-save', maintenanceController.saveFile);
router.post('/api/file-delete', maintenanceController.deleteFile);
router.get('/api/file-download', maintenanceController.downloadFile);
router.get('/api/db-tables', maintenanceController.getDatabaseTables);
router.get('/api/db-data', maintenanceController.getTableData);
router.post('/api/db-update', maintenanceController.updateTableRecord);
router.post('/api/db-delete', maintenanceController.deleteTableRecord);
router.get('/api/pm2-logs', maintenanceController.getPM2Logs);
router.post('/api/pm2-logs/clear', maintenanceController.clearPM2Logs);
router.get('/api/notification-users', maintenanceController.getNotificationTest);
router.post('/api/notification-send', maintenanceController.sendTestNotification);

// Backup Tools
router.get('/api/backups', maintenanceController.getBackups);
router.post('/api/backups/create', maintenanceController.createBackup);
router.post('/api/backups/delete', maintenanceController.deleteBackup);
router.get('/api/backups/content', maintenanceController.getBackupContent);
router.get('/api/backups/download', maintenanceController.downloadBackup);
router.post('/api/backups/upload', upload.single('backup'), maintenanceController.uploadBackup);
router.post('/api/backups/restore', maintenanceController.restoreBackup);

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

// Registrations Management (Admins only for these actions)
router.post('/registrations/new-period', adminController.startNewPeriod);
router.post('/registrations/delete-period', adminController.deleteLastPeriod);
router.get('/registrations/:id/edit', adminController.getEditRegistration);
router.put('/registrations/:id', adminController.updateRegistration);
router.delete('/registrations/:id', adminController.deleteRegistration);

// Danger Zone
router.post('/danger/reset-registrations', adminController.resetRegistrations);
router.post('/danger/reset-website', adminController.resetWebsite);
router.post('/danger/backup', adminController.triggerBackup);
router.get('/danger/test-push', adminController.testPush);

const financeController = require('../controllers/financeController');

// --- Finance Tool ---
router.get('/finance', financeController.getIndex); // Root
router.get('/finance/info', financeController.getInfo); // Info/Help Page
router.get('/finance/export/unpaid', financeController.exportUnpaid);
router.get('/finance/export/root', financeController.exportFolder);
router.get('/finance/:folderId', financeController.getIndex); // Subfolder
router.post('/finance', financeController.postItem); // Create in Root
router.post('/finance/:folderId', financeController.postItem); // Create in Subfolder
router.put('/finance/item/:id', financeController.updateItem); // Update Item
router.delete('/finance/item/:id', financeController.deleteItem);
router.get('/finance/:folderId/export', financeController.exportFolder);

// Leidingshoekjes beheer
router.get('/feedgroups', adminController.getFeedGroups);
router.post('/feedgroups', adminController.postFeedGroup);
router.put('/feedgroups/:id', adminController.updateFeedGroup);
router.delete('/feedgroups/:id', adminController.deleteFeedGroup);

module.exports = router;
