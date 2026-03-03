const crypto = require('crypto');

const generateReference = (prefix) => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const generateApplicationNumber = () => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `APP-${year}-${random}`;
};

const generateBookingReference = () => {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BK-${random}`;
};

const generatePaymentReference = () => {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PAY-${random}`;
};

const generateInvitationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  generateReference,
  generateApplicationNumber,
  generateBookingReference,
  generatePaymentReference,
  generateInvitationToken,
};