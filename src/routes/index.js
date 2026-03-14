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

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         role:
 *           type: string
 *           enum: [SUPER_ADMIN, CONSULTANT, CLIENT]
 *         isActive:
 *           type: boolean
 *         phone:
 *           type: string
 *         profilePictureUrl:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     Application:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         applicationNumber:
 *           type: string
 *         status:
 *           type: string
 *           enum: [DRAFT, SUBMITTED, UNDER_REVIEW, DOCUMENTS_MISSING, PROCESSING, APPROVED, REJECTED, CLOSED]
 *         country:
 *           type: string
 *         formData:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     Booking:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         bookingReference:
 *           type: string
 *         clientName:
 *           type: string
 *         clientEmail:
 *           type: string
 *           format: email
 *         scheduledStart:
 *           type: string
 *           format: date-time
 *         scheduledEnd:
 *           type: string
 *           format: date-time
 *         bookingStatus:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, COMPLETED, NO_SHOW]
 *         meetingLink:
 *           type: string
 *     
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         fileName:
 *           type: string
 *         fileSize:
 *           type: number
 *         mimeType:
 *           type: string
 *         documentType:
 *           type: string
 *         version:
 *           type: number
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *     
 *     Payment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         paymentReference:
 *           type: string
 *         amount:
 *           type: number
 *         currency:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, PAID, FAILED, REFUNDED]
 *         paymentType:
 *           type: string
 *           enum: [CONSULTATION, PROCESSING]
 *         paidAt:
 *           type: string
 *           format: date-time
 *     
 *     Service:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         basePrice:
 *           type: number
 *         currency:
 *           type: string
 *         isActive:
 *           type: boolean
 *     
 *     Error:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 *     
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *     
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         phone:
 *           type: string
 *     
 *     AuthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             accessToken:
 *               type: string
 *             refreshToken:
 *               type: string
 *     
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *     
 *   responses:
 *     UnauthorizedError:
 *       description: Access token is missing or invalid
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *     ForbiddenError:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *     NotFoundError:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [System]
 *     summary: Health check endpoint
 *     description: Returns the current status of the API server
 *     responses:
 *       200:
 *         description: Server is up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
/**
 * @swagger
 * /api/services:
 *   get:
 *     tags: [Services]
 *     summary: Get all active services
 *     description: Returns a list of all active immigration services
 *     responses:
 *       200:
 *         description: List of services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     services:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Service'
 */
// ==================== SERVICES ROUTES (PUBLIC) ====================
router.get('/services', servicesController.getActiveServices);

// ==================== AUTH ROUTES ====================
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new client
 *     description: Creates a new client account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/auth/register', validate(registerValidation), authController.register);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     description: Authenticates user and returns JWT tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/auth/login', validate(loginValidation), authController.login);
/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: Get a new access token using refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New tokens generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Invalid refresh token
 */
router.post('/auth/refresh-token', authController.refreshToken);
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout user
 *     description: Logs out the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/auth/logout', protect, authController.logout);
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user
 *     description: Returns the profile of the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/auth/me', protect, authController.getMe);

// ==================== USER ROUTES ====================
/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users (Admin only)
 *     description: Returns a paginated list of all users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [SUPER_ADMIN, CONSULTANT, CLIENT]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 results:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/users', protect, restrictTo('SUPER_ADMIN'), userController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID (Admin only)
 *     description: Returns detailed information about a specific user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/users/:id', protect, restrictTo('SUPER_ADMIN'), userController.getUser);
/**
 * @swagger
 * /api/users/consultant:
 *   post:
 *     tags: [Users]
 *     summary: Create consultant (Admin only)
 *     description: Creates a new consultant user and sends invitation email
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Consultant invitation sent
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/users/consultant', protect, restrictTo('SUPER_ADMIN'), userController.createConsultant);

/**
 * @swagger
 * /api/users/{id}/deactivate:
 *   patch:
 *     tags: [Users]
 *     summary: Deactivate user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deactivated
 */
router.patch('/users/:id/deactivate', protect, restrictTo('SUPER_ADMIN'), userController.deactivateUser);
/**
 * @swagger
 * /api/users/{id}/activate:
 *   patch:
 *     tags: [Users]
 *     summary: Activate user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User activated
 */
router.patch('/users/:id/activate', protect, restrictTo('SUPER_ADMIN'), userController.activateUser);
/**
 * @swagger
 * /api/users/profile:
 *   patch:
 *     tags: [Users]
 *     summary: Update user profile
 *     description: Updates the profile of the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 */
router.patch('/users/profile', protect, userController.updateUserProfile);
/**
 * @swagger
 * /api/users/accept-invitation:
 *   post:
 *     tags: [Users]
 *     summary: Accept invitation
 *     description: Accepts consultant invitation and creates account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.post('/users/accept-invitation', userController.acceptInvitation);

// ==================== APPLICATION ROUTES ====================
/**
 * @swagger
 * /api/applications:
 *   get:
 *     tags: [Applications]
 *     summary: Get all applications (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, SUBMITTED, UNDER_REVIEW, DOCUMENTS_MISSING, PROCESSING, APPROVED, REJECTED, CLOSED]
 *       - in: query
 *         name: consultantId
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of applications
 */
router.get('/applications', protect, restrictTo('SUPER_ADMIN'), applicationController.getAllApplications);
/**
 * @swagger
 * /api/applications/my-applications:
 *   get:
 *     tags: [Applications]
 *     summary: Get client's applications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client's applications
 */
router.get('/applications/my-applications', protect, restrictTo('CLIENT'), applicationController.getMyApplications);
/**
 * @swagger
 * /api/applications/consultant:
 *   get:
 *     tags: [Applications]
 *     summary: Get consultant's assigned applications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Consultant's applications
 */
router.get('/applications/consultant', protect, restrictTo('CONSULTANT'), applicationController.getConsultantApplications);

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     tags: [Applications]
 *     summary: Get application by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Application details
 *       404:
 *         description: Application not found
 */
router.get('/applications/:id', protect, applicationController.getApplication);
/**
 * @swagger
 * /api/applications:
 *   post:
 *     tags: [Applications]
 *     summary: Create new application
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serviceId:
 *                 type: string
 *               country:
 *                 type: string
 *               formData:
 *                 type: object
 *     responses:
 *       201:
 *         description: Application created
 */
router.post('/applications', protect, restrictTo('CLIENT'), validate(createApplicationValidation), applicationController.createApplication);
/**
 * @swagger
 * /api/applications/{id}:
 *   patch:
 *     tags: [Applications]
 *     summary: Update application (Client only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formData:
 *                 type: object
 *               country:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application updated
 */
router.patch('/applications/:id', protect, restrictTo('CLIENT'), applicationController.updateApplication);
/**
 * @swagger
 * /api/applications/{id}/submit:
 *   patch:
 *     tags: [Applications]
 *     summary: Submit application (Client only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application submitted
 */
router.patch('/applications/:id/submit', protect, restrictTo('CLIENT'), applicationController.submitApplication);
/**
 * @swagger
 * /api/applications/{id}/status:
 *   patch:
 *     tags: [Applications]
 *     summary: Update application status (Admin/Consultant only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, SUBMITTED, UNDER_REVIEW, DOCUMENTS_MISSING, PROCESSING, APPROVED, REJECTED, CLOSED]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/applications/:id/status', protect, restrictTo('SUPER_ADMIN', 'CONSULTANT'), applicationController.updateApplicationStatus);
/**
 * @swagger
 * /api/applications/{id}/assign:
 *   post:
 *     tags: [Applications]
 *     summary: Assign consultant to application (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consultantId
 *             properties:
 *               consultantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Consultant assigned
 */
router.post('/applications/:id/assign', protect, restrictTo('SUPER_ADMIN'), applicationController.assignConsultant);

/**
 * @swagger
 * /api/applications/{id}/notes:
 *   post:
 *     tags: [Applications]
 *     summary: Add note to application (Admin/Consultant only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - noteType
 *               - content
 *             properties:
 *               noteType:
 *                 type: string
 *                 enum: [INTERNAL, CLIENT_VISIBLE]
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Note added
 */
router.post('/applications/:id/notes', protect, restrictTo('SUPER_ADMIN', 'CONSULTANT'), applicationController.addConsultantNote);

// ==================== BOOKING ROUTES ====================
// router.get('/bookings', protect, restrictTo('SUPER_ADMIN'), bookingController.getAllBookings);
// router.get('/bookings/my-bookings', protect, restrictTo('CLIENT'), bookingController.getMyBookings);
// router.get('/bookings/:id', protect, bookingController.getBooking);
// router.post('/bookings', validate(createBookingValidation), bookingController.createBooking); // Public route
// router.patch('/bookings/:id/approve', protect, restrictTo('SUPER_ADMIN'), bookingController.approveBooking);
// router.patch('/bookings/:id/reject', protect, restrictTo('SUPER_ADMIN'), bookingController.rejectBooking);
// router.patch('/bookings/:id/complete', protect, restrictTo('SUPER_ADMIN'), bookingController.completeBooking);
// router.patch('/bookings/:id/no-show', protect, restrictTo('SUPER_ADMIN'), bookingController.markNoShow);

// ===== CAL.COM WEBHOOK (PUBLIC - NO AUTH) =====
// This must be PUBLIC - Cal.com servers call this
/**
 * @swagger
 * /api/calcom/webhook:
 *   post:
 *     tags: [Cal.com]
 *     summary: Cal.com webhook endpoint
 *     description: Receives booking events from Cal.com (public endpoint)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received
 */
router.post('/calcom/webhook', calcomController.handleWebhook);

// ===== YOUR EXISTING BOOKING ROUTES (unchanged) =====
/**
 * @swagger
 * /api/bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: Get all bookings (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, COMPLETED, NO_SHOW]
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of bookings
 */
router.get('/bookings', protect, restrictTo('SUPER_ADMIN'), bookingController.getAllBookings);
/**
 * @swagger
 * /api/bookings/my-bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: Get client's bookings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client's bookings
 */
router.get('/bookings/my-bookings', protect, restrictTo('CLIENT'), bookingController.getMyBookings);
/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get booking by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking details
 */
router.get('/bookings/:id', protect, bookingController.getBooking);
/**
 * @swagger
 * /api/bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Create new booking (Public)
 *     description: Create a consultation booking (no authentication required)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientName
 *               - clientEmail
 *               - scheduledStart
 *               - scheduledEnd
 *             properties:
 *               clientName:
 *                 type: string
 *               clientEmail:
 *                 type: string
 *                 format: email
 *               clientPhone:
 *                 type: string
 *               serviceId:
 *                 type: string
 *               scheduledStart:
 *                 type: string
 *                 format: date-time
 *               scheduledEnd:
 *                 type: string
 *                 format: date-time
 *               timezone:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking created
 */
router.post('/bookings', validate(createBookingValidation), bookingController.createBooking); 

/**
 * @swagger
 * /api/bookings/{id}/approve:
 *   patch:
 *     tags: [Bookings]
 *     summary: Approve booking (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meetingLink:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking approved
 */
router.patch('/bookings/:id/approve', protect, restrictTo('SUPER_ADMIN'), bookingController.approveBooking);
/**
 * @swagger
 * /api/bookings/{id}/reject:
 *   patch:
 *     tags: [Bookings]
 *     summary: Reject booking (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking rejected
 */
router.patch('/bookings/:id/reject', protect, restrictTo('SUPER_ADMIN'), bookingController.rejectBooking);
/**
 * @swagger
 * /api/bookings/{id}/complete:
 *   patch:
 *     tags: [Bookings]
 *     summary: Mark booking as completed (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking completed
 */
router.patch('/bookings/:id/complete', protect, restrictTo('SUPER_ADMIN'), bookingController.completeBooking);
router.patch('/bookings/:id/complete', protect, restrictTo('SUPER_ADMIN'), bookingController.completeBooking);

/**
 * @swagger
 * /api/bookings/{id}/no-show:
 *   patch:
 *     tags: [Bookings]
 *     summary: Mark booking as no-show (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking marked as no-show
 */

router.patch('/bookings/:id/no-show', protect, restrictTo('SUPER_ADMIN'), bookingController.markNoShow);

// ===== OPTIONAL: Public booking lookup (for "track your booking" page) =====

/**
 * @swagger
 * /api/public/bookings/{bookingReference}:
 *   get:
 *     tags: [Bookings]
 *     summary: Public booking lookup
 *     description: Get booking details by reference (public endpoint)
 *     parameters:
 *       - in: path
 *         name: bookingReference
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking details
 */
router.get('/public/bookings/:bookingReference', calcomController.getPublicBooking);

// ==================== DOCUMENT ROUTES ====================
/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     tags: [Documents]
 *     summary: Upload document
 *     description: Upload a document for an application
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - applicationId
 *               - document
 *             properties:
 *               applicationId:
 *                 type: string
 *               documentType:
 *                 type: string
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Document uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     document:
 *                       $ref: '#/components/schemas/Document'
 */

router.post('/documents/upload',
  protect,
  upload.single('document'),
  handleUploadError,
  documentController.uploadDocument
);

/**
 * @swagger
 * /api/documents/application/{applicationId}:
 *   get:
 *     tags: [Documents]
 *     summary: Get application documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/documents/application/:applicationId', protect, documentController.getApplicationDocuments);
/**
 * @swagger
 * /api/documents/{id}/download:
 *   get:
 *     tags: [Documents]
 *     summary: Download document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document file
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/documents/:id/download', protect, documentController.downloadDocument);
/**
 * @swagger
 * /api/documents/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Delete document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document deleted
 */
router.delete('/documents/:id', protect, documentController.deleteDocument);
/**
 * @swagger
 * /api/documents/{id}/versions:
 *   get:
 *     tags: [Documents]
 *     summary: Get document versions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document versions
 */
router.get('/documents/:id/versions', protect, documentController.getDocumentVersions);

// ==================== PAYMENT ROUTES ====================
/**
 * @swagger
 * /api/payments/create-session:
 *   post:
 *     tags: [Payments]
 *     summary: Create Stripe checkout session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentType
 *             properties:
 *               applicationId:
 *                 type: string
 *               bookingId:
 *                 type: string
 *               paymentType:
 *                 type: string
 *                 enum: [CONSULTATION, PROCESSING]
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                     url:
 *                       type: string
 */
router.post('/payments/create-session', protect, paymentController.createPaymentSession);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Stripe webhook endpoint
 *     description: Receives payment events from Stripe (public endpoint)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received
 */
router.post('/payments/webhook', paymentController.handleWebhook);
/**
 * @swagger
 * /api/payments/verify-session/{sessionId}:
 *   get:
 *     tags: [Payments]
 *     summary: Verify payment session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session verification result
 */
router.get('/payments/verify-session/:sessionId', protect, paymentController.verifyPaymentSession);
/**
 * @swagger
 * /api/payments/my-payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get user's payments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's payments
 */
router.get('/payments/my-payments', protect, paymentController.getMyPayments);
/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details
 */
router.get('/payments/:id', protect, paymentController.getPaymentStatus);
/**
 * @swagger
 * /api/payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get all payments (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, FAILED, REFUNDED]
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: string
 *           enum: [CONSULTATION, PROCESSING]
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of payments
 */
router.get('/payments', protect, restrictTo('SUPER_ADMIN'), paymentController.getAllPayments);
/**
 * @swagger
 * /api/payments/{id}/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Refund payment (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment refunded
 */
router.post('/payments/:id/refund', protect, restrictTo('SUPER_ADMIN'), paymentController.refundPayment);

// ==================== ANALYTICS ROUTES ====================
/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Get dashboard statistics (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/analytics/dashboard', protect, restrictTo('SUPER_ADMIN'), analyticsController.getDashboardStats);
/**
 * @swagger
 * /api/analytics/revenue:
 *   get:
 *     tags: [Analytics]
 *     summary: Get revenue analytics (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, month, year]
 *     responses:
 *       200:
 *         description: Revenue analytics
 */
router.get('/analytics/revenue', protect, restrictTo('SUPER_ADMIN'), analyticsController.getRevenueAnalytics);

/**
 * @swagger
 * /api/analytics/applications:
 *   get:
 *     tags: [Analytics]
 *     summary: Get application analytics (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Application analytics
 */
router.get('/analytics/applications', protect, restrictTo('SUPER_ADMIN'), analyticsController.getApplicationAnalytics);

/**
 * @swagger
 * /api/analytics/consultants/performance:
 *   get:
 *     tags: [Analytics]
 *     summary: Get consultant performance (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Consultant performance metrics
 */
router.get('/analytics/consultants/performance', protect, restrictTo('SUPER_ADMIN'), analyticsController.getConsultantPerformance);

/**
 * @swagger
 * /api/analytics/logs:
 *   get:
 *     tags: [Analytics]
 *     summary: Get activity logs (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Activity logs
 */
router.get('/analytics/logs', protect, restrictTo('SUPER_ADMIN'), analyticsController.getActivityLogs);

// ==================== ERROR HANDLING ====================
router.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

module.exports = router;