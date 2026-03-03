const prisma = require('../config/database');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { generateInvitationToken } = require('../utils/helpers');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { UserRole } = require('../utils/constants');

const getAllUsers = catchAsync(async (req, res) => {
  const { role, isActive, page = 1, limit = 10 } = req.query;

  const skip = (page - 1) * limit;

  const where = {};

  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            applications: true,
            bookings: true,
            payments: true,
            documents: true,
            assignedApplications: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count({ where }),
  ]);
  console.log({
    status: 'success',
    results: users.length,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: parseInt(page),
    data: {
      users,
    },
  });


  res.json({
    status: 'success',
    results: users.length,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: parseInt(page),
    data: {
      users,
    },
  });
});

const getUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  console.log('🔍 Fetching user with ID:', id);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      phone: true,
      profilePictureUrl: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      deactivatedAt: true,
      deactivatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      _count: {
        select: {
          applications: true,
          bookings: true,
          payments: true,
          documents: true,
          assignedApplications: true,
          notes: true,
          documentVersions: true,
          activities: true,
          consultantAssignments: true,
          assignmentsMade: true,
          invitationsSent: true,
          statusChanges: true,
          approvedBookings: true,
          deactivatedUsers: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      user,
    },
  });
});

const createConsultant = catchAsync(async (req, res) => {
  const { email, firstName, lastName, phone } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError('User already exists with this email', 400);
  }

  // Generate temporary password
  const tempPassword = generateTemporaryPassword();
  console.log('🔑 Generated temporary password for:', email);

  // Hash the temporary password using authService
  const hashedPassword = await authService.hashPassword(tempPassword);

  // Create the user directly with temporary password
  console.log('📝 Creating user in database...');
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      phone,
      passwordHash: hashedPassword,
      role: UserRole.CONSULTANT,
      isActive: true,
    },
  });

  console.log('✅ User created with ID:', user.id);

  // Send email with temporary password
  console.log('📧 Attempting to send temporary password email...');
  try {
    await emailService.sendTemporaryPasswordEmail(
      email,
      tempPassword,
      firstName,
      UserRole.CONSULTANT
    );
    console.log('🚀 Email sent successfully to:', email);
  } catch (emailError) {
    console.error('❌ Failed to send email:', emailError);
    // We don't necessarily want to fail the whole request if email fails, 
    // but the user should know. 
  }

  await authService.createActivityLog(
    req.user.id,
    'CONSULTANT_CREATED',
    'USER',
    user.id,
    null,
    { email, role: UserRole.CONSULTANT },
    req
  );

  res.status(201).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    },
  });
});

// Helper function to generate temporary password
function generateTemporaryPassword(length = 10) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';

  // Simpler password without special chars for easier typing
  const allChars = uppercase + lowercase + numbers;

  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const deactivateUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.isActive) {
    throw new AppError('User is already deactivated', 400);
  }

  const deactivatedUser = await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedById: req.user.id,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      deactivatedAt: true,
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'USER_DEACTIVATED',
    'USER',
    id,
    { isActive: true },
    { isActive: false },
    req
  );

  res.json({
    status: 'success',
    data: {
      user: deactivatedUser,
    },
  });
});

const activateUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.isActive) {
    throw new AppError('User is already active', 400);
  }

  const activatedUser = await prisma.user.update({
    where: { id },
    data: {
      isActive: true,
      deactivatedAt: null,
      deactivatedById: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'USER_ACTIVATED',
    'USER',
    id,
    { isActive: false },
    { isActive: true },
    req
  );

  res.json({
    status: 'success',
    data: {
      user: activatedUser,
    },
  });
});

const updateUserProfile = catchAsync(async (req, res) => {
  const { firstName, lastName, phone } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      firstName,
      lastName,
      phone,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
    },
  });

  res.json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

const acceptInvitation = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    throw new AppError('Invalid invitation token', 400);
  }

  if (invitation.expiresAt < new Date()) {
    throw new AppError('Invitation has expired', 400);
  }

  if (invitation.acceptedAt) {
    throw new AppError('Invitation has already been accepted', 400);
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
  });

  if (existingUser) {
    throw new AppError('User already exists with this email', 400);
  }

  // Hash password
  const hashedPassword = await authService.hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: invitation.email,
      passwordHash: hashedPassword,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      role: invitation.role,
      isActive: true,
    },
  });

  // Mark invitation as accepted
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      acceptedAt: new Date(),
    },
  });

  await authService.createActivityLog(
    user.id,
    'INVITATION_ACCEPTED',
    'USER',
    user.id,
    null,
    { email: user.email, role: user.role },
    req
  );

  // Generate tokens
  const tokens = authService.generateTokens(user);

  res.status(201).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    },
  });
});

module.exports = {
  getAllUsers,
  getUser,
  createConsultant,
  deactivateUser,
  activateUser,
  updateUserProfile,
  acceptInvitation,
};