const multer = require('multer');
const { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } = require('../utils/constants');
const AppError = require('../utils/AppError');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('File type not allowed. Please upload PDF, DOC, DOCX, JPG, JPEG, or PNG files.', 400), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: fileFilter,
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, 400));
    }
    return next(new AppError(`Upload error: ${err.message}`, 400));
  }
  next(err);
};

module.exports = {
  upload,
  handleUploadError,
};