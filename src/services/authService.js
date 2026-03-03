const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn, jwtRefreshSecret, jwtRefreshExpiresIn, bcryptSaltRounds } = require('../config/auth');
const prisma = require('../config/database');
const AppError = require('../utils/AppError');

class AuthService {
  async hashPassword(password) {
    return await bcrypt.hash(password, bcryptSaltRounds);
  }

  async comparePasswords(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      jwtRefreshSecret,
      { expiresIn: jwtRefreshExpiresIn }
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, jwtSecret);
    } catch (error) {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, jwtRefreshSecret);
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  async createActivityLog(userId, actionType, entityType, entityId, oldData = null, newData = null, req = null) {
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          actionType,
          entityType,
          entityId,
          oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
          newData: newData ? JSON.parse(JSON.stringify(newData)) : null,
          ipAddress: req?.ip,
          userAgent: req?.get('user-agent'),
        },
      });
    } catch (error) {
      console.error('Failed to create activity log:', error);
    }
  }
}

module.exports = new AuthService();