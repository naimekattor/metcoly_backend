const prisma = require('../config/database');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const getSetting = catchAsync(async (req, res) => {
  const { key } = req.params;

  const setting = await prisma.globalSetting.findUnique({
    where: { key }
  });

  if (!setting) {
    // If setting doesn't exist yet, return empty or default
    return res.json({
      status: 'success',
      data: { key, value: '' }
    });
  }

  res.json({
    status: 'success',
    data: setting
  });
});

const updateSetting = catchAsync(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    throw new AppError('Value is required', 400);
  }

  const setting = await prisma.globalSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });

  res.json({
    status: 'success',
    data: setting
  });
});

module.exports = {
  getSetting,
  updateSetting
};
