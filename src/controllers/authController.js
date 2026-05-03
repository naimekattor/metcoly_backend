const crypto = require('crypto');
const prisma = require('../config/database');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { generateInvitationToken } = require('../utils/helpers');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { UserRole } = require('../utils/constants');

const register = catchAsync(async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError('User already exists with this email', 400);
  }

  const hashedPassword = await authService.hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      phone,
      role: UserRole.CLIENT,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  });

  await emailService.sendWelcomeEmail(user);
  
  await authService.createActivityLog(
    user.id,
    'USER_REGISTERED',
    'USER',
    user.id,
    null,
    user,
    req
  );

  const tokens = authService.generateTokens(user);

  res.status(201).json({
    status: 'success',
    data: {
      user,
      ...tokens,
    },
  });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await authService.comparePasswords(password, user.passwordHash))) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact support.', 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await authService.createActivityLog(
    user.id,
    'USER_LOGIN',
    'USER',
    user.id,
    null,
    null,
    req
  );

  const userData = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };

  const tokens = authService.generateTokens(userData);

  res.json({
    status: 'success',
    data: {
      user: userData,
      ...tokens,
    },
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  const decoded = authService.verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 401);
  }

  const tokens = authService.generateTokens(user);

  res.json({
    status: 'success',
    data: tokens,
  });
});

const logout = catchAsync(async (req, res) => {
  await authService.createActivityLog(
    req.user.id,
    'USER_LOGOUT',
    'USER',
    req.user.id,
    null,
    null,
    req
  );

  res.json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

const getMe = catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError('There is no user with that email address.', 404);
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
    },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {
    await emailService.sendPasswordResetEmail(user, resetUrl);

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    console.error('Error sending reset email:', err);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    throw new AppError('There was an error sending the email. Try again later!', 500);
  }
});

const resetPassword = catchAsync(async (req, res) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new AppError('Token is invalid or has expired', 400);
  }

  const hashedPassword = await authService.hashPassword(req.body.password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });

  await authService.createActivityLog(
    user.id,
    'PASSWORD_RESET',
    'USER',
    user.id,
    null,
    null,
    req
  );

  const tokens = authService.generateTokens(user);

  res.status(200).json({
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

const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user || !(await authService.comparePasswords(currentPassword, user.passwordHash))) {
    throw new AppError('Current password is incorrect', 400);
  }

  const hashedPassword = await authService.hashPassword(newPassword);

  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: hashedPassword },
  });

  await authService.createActivityLog(
    user.id,
    'PASSWORD_CHANGED',
    'USER',
    user.id,
    null,
    null,
    req
  );

  res.json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
};