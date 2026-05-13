const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const uploadController = require('../controllers/uploadController');
const maintenanceController = require('../controllers/maintenanceController');
const formController = require('../controllers/formController');
const customPageController = require('../controllers/customPageController');
const { ensureAuthenticated, ensureAdmin, ensureMedia } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { compressGenericImage } = require('../middleware/imageCompression');
const SettingsService = require('../services/SettingsService');

router.use(ensureAuthenticated);

// Permission middleware for forms
const checkFormPermission = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'media' || SettingsService.get('allow_all_forms_access')) {
        return next();
    }
    res.redirect('/admin');
};

const checkAdminDashboardAccess = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'media' || SettingsService.get('allow_all_forms_access') || SettingsService.get('move_menu_to_dashboard')) {
        return next();
    }
    res.redirect('/');
};

// Conditional Access for Registrations
const checkViewRegistrationsPermission = (req, res, next) => {
    if (req.user.role === 'admin' || SettingsService.get('enable_public_registrations_view')) {
        return next();
    }
    res.redirect('/');
};

router.get('/registrations', checkViewRegistrationsPermission, adminController.getRegistrations);
router.post('/registrations/toggle', ensureAdmin, adminController.postToggleRegistration);
router.get('/registrations/export', checkViewRegistrationsPermission, adminController.exportRegistrationsExcel);
router.get('/registrations/export-pdf', checkViewRegistrationsPermission, adminController.exportRegistrationsPDF);

// --- Routes accessible by both Admin and Media ---
router.get('/', checkAdminDashboardAccess, adminController.getDashboard);
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
router.get('/forms', checkFormPermission, formController.getForms);
router.get('/forms/create', checkFormPermission, formController.getCreateForm);
router.post('/forms', checkFormPermission, upload.single('bannerImage'), compressGenericImage, formController.postCreateForm);
router.get('/forms/:id/edit', checkFormPermission, formController.getEditForm);
router.post('/forms/:id/edit', checkFormPermission, upload.single('bannerImage'), compressGenericImage, formController.postEditForm);
router.post('/forms/:id/delete', checkFormPermission, formController.postDeleteForm);
router.get('/forms/:id/responses', checkFormPermission, formController.getResponses);
router.get('/forms/:id/responses/export', checkFormPermission, formController.exportResponses);
router.get('/forms/:id/responses/export-eetdag', checkFormPermission, formController.exportEetdagPDF);
router.put('/forms/responses/:id', checkFormPermission, formController.updateResponse);
router.post('/forms/responses/:id', checkFormPermission, formController.deleteResponse);

// Custom Page Builder
router.get('/custom-pages', ensureMedia, customPageController.getCustomPages);
router.get('/custom-pages/create', ensureMedia, customPageController.getCreatePage);
router.post('/custom-pages', ensureMedia, upload.single('bannerImage'), compressGenericImage, customPageController.postCreatePage);
router.get('/custom-pages/:id/edit', ensureMedia, customPageController.getEditPage);
router.post('/custom-pages/:id/edit', ensureMedia, upload.single('bannerImage'), compressGenericImage, customPageController.postEditPage);
router.post('/custom-pages/:id/delete', ensureMedia, customPageController.deletePage);

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

// Site Settings
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.postSettings);
router.post('/settings/reset', adminController.resetSettings);

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
