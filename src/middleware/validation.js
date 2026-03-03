const { body, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
    }));

    return next(new AppError(JSON.stringify(extractedErrors), 400));
  };
};

const registerValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const createApplicationValidation = [
  body('serviceId').optional().isUUID().withMessage('Invalid service ID'),
  body('country').optional().isString(),
  body('formData').optional().isObject(),
];

const createBookingValidation = [
  body('scheduledStart').isISO8601().withMessage('Please provide a valid start date'),
  body('scheduledEnd').isISO8601().withMessage('Please provide a valid end date'),
  body('clientName').notEmpty().withMessage('Client name is required'),
  body('clientEmail').isEmail().withMessage('Please provide a valid email'),
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  createApplicationValidation,
  createBookingValidation,
};