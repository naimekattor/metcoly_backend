const AppError = require('../utils/AppError');

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You are not logged in.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }

    next();
  };
};

const checkConsultantAccess = (req, res, next) => {
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  if (req.user.role === 'CONSULTANT' && req.params.applicationId) {
    // Consultant can only access their assigned applications
    req.consultantAccessCheck = true;
    return next();
  }

  return next(new AppError('You do not have permission to access this resource.', 403));
};

module.exports = { restrictTo, checkConsultantAccess };