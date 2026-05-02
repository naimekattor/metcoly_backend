const express = require('express');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/roleCheck');
const { validate, registerValidation, loginValidation, createApplicationValidation, createBookingValidation } = require('../middleware/validation');
const { upload, handleUploadError } = require('../middleware/upload');

// Controllers
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const applicationController = require('../controllers/applicationController');
const bookingController = require('../controllers/bookingController');
const documentController = require('../controllers/documentController');
const paymentController = require('../controllers/paymentController');
const analyticsController = require('../controllers/analyticsController');
const calcomController = require('../controllers/calcomController');
const servicesController = require('../controllers/servicesController');

const router = express.Router();
// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== SERVICES ROUTES (PUBLIC) ====================
router.get('/services', servicesController.getActiveServices);

// ==================== AUTH ROUTES ====================
router.post('/auth/register', validate(registerValidation), authController.register);
router.post('/auth/login', validate(loginValidation), authController.login);
router.post('/auth/refresh-token', authController.refreshToken);
router.post('/auth/logout', protect, authController.logout);
router.get('/auth/me', protect, authController.getMe);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password/:token', authController.resetPassword);

// ==================== USER ROUTES ====================
router.get('/users', protect, restrictTo('SUPER_ADMIN'), userController.getAllUsers);
router.get('/users/:id', protect, restrictTo('SUPER_ADMIN'), userController.getUser);
router.post('/users/consultant', protect, restrictTo('SUPER_ADMIN'), userController.createConsultant);
router.patch('/users/:id/deactivate', protect, restrictTo('SUPER_ADMIN'), userController.deactivateUser);
router.patch('/users/:id/activate', protect, restrictTo('SUPER_ADMIN'), userController.activateUser);
router.patch('/users/profile', protect, userController.updateUserProfile);
router.post('/users/accept-invitation', userController.acceptInvitation);

// ==================== APPLICATION ROUTES ====================
router.get('/applications', protect, restrictTo('SUPER_ADMIN'), applicationController.getAllApplications);
router.get('/applications/my-applications', protect, restrictTo('CLIENT'), applicationController.getMyApplications);
router.get('/applications/consultant', protect, restrictTo('CONSULTANT'), applicationController.getConsultantApplications);
router.get('/applications/:id', protect, applicationController.getApplication);
router.post('/applications', protect, restrictTo('CLIENT'), validate(createApplicationValidation), applicationController.createApplication);
router.patch('/applications/:id', protect, restrictTo('CLIENT'), applicationController.updateApplication);
router.patch('/applications/:id/submit', protect, restrictTo('CLIENT'), applicationController.submitApplication);
router.patch('/applications/:id/status', protect, restrictTo('SUPER_ADMIN', 'CONSULTANT'), applicationController.updateApplicationStatus);
router.post('/applications/:id/assign', protect, restrictTo('SUPER_ADMIN'), applicationController.assignConsultant);
router.post('/applications/:id/notes', protect, restrictTo('SUPER_ADMIN', 'CONSULTANT'), applicationController.addConsultantNote);

// ==================== BOOKING ROUTES ====================

// ===== CAL.COM WEBHOOK (PUBLIC - NO AUTH) =====
// This must be PUBLIC - Cal.com servers call this
router.post('/calcom/webhook', calcomController.handleWebhook);

// ===== BOOKING ROUTES =====
router.get('/bookings', protect, restrictTo('SUPER_ADMIN'), bookingController.getAllBookings);
router.get('/bookings/my-bookings', protect, restrictTo('CLIENT'), bookingController.getMyBookings);
router.get('/bookings/:id', protect, bookingController.getBooking);
router.post('/bookings', validate(createBookingValidation), bookingController.createBooking);
router.patch('/bookings/:id/approve', protect, restrictTo('SUPER_ADMIN'), bookingController.approveBooking);
router.patch('/bookings/:id/reject', protect, restrictTo('SUPER_ADMIN'), bookingController.rejectBooking);
router.patch('/bookings/:id/complete', protect, restrictTo('SUPER_ADMIN'), bookingController.completeBooking);

router.patch('/bookings/:id/no-show', protect, restrictTo('SUPER_ADMIN'), bookingController.markNoShow);

// ===== PUBLIC: Booking lookup =====

router.get('/public/bookings/:bookingReference', calcomController.getPublicBooking);

// ==================== DOCUMENT ROUTES ====================

router.post('/documents/upload',
  protect,
  upload.single('document'),
  handleUploadError,
  documentController.uploadDocument
);
router.get('/documents/application/:applicationId', protect, documentController.getApplicationDocuments);
router.get('/documents/:id/download', protect, documentController.downloadDocument);
router.delete('/documents/:id', protect, documentController.deleteDocument);
router.get('/documents/:id/versions', protect, documentController.getDocumentVersions);

// ==================== PAYMENT ROUTES ====================
router.post('/payments/create-session', protect, paymentController.createPaymentSession);
router.post('/payments/webhook', paymentController.handleWebhook);
router.get('/payments/verify-session/:sessionId', protect, paymentController.verifyPaymentSession);
router.get('/payments/my-payments', protect, paymentController.getMyPayments);
router.get('/payments/:id', protect, paymentController.getPaymentStatus);
router.get('/payments', protect, restrictTo('SUPER_ADMIN'), paymentController.getAllPayments);
router.post('/payments/:id/refund', protect, restrictTo('SUPER_ADMIN'), paymentController.refundPayment);

// ==================== ANALYTICS ROUTES ====================
router.get('/analytics/dashboard', protect, restrictTo('SUPER_ADMIN'), analyticsController.getDashboardStats);
router.get('/analytics/revenue', protect, restrictTo('SUPER_ADMIN'), analyticsController.getRevenueAnalytics);
router.get('/analytics/applications', protect, restrictTo('SUPER_ADMIN'), analyticsController.getApplicationAnalytics);
router.get('/analytics/consultants/performance', protect, restrictTo('SUPER_ADMIN'), analyticsController.getConsultantPerformance);
router.get('/analytics/logs', protect, restrictTo('SUPER_ADMIN'), analyticsController.getActivityLogs);

// ==================== ERROR HANDLING ====================
router.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

module.exports = router;