const fs = require('fs').promises;
const path = require('path');
const { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } = require('../utils/constants');
const AppError = require('../utils/AppError');

class FileService {
  constructor() {
    this.uploadPath = process.env.UPLOAD_PATH || 'uploads';
    this.ensureUploadDirectory();
  }

  async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadPath);
    } catch {
      await fs.mkdir(this.uploadPath, { recursive: true });
    }
  }

  validateFile(file) {
    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, 400);
    }

    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      throw new AppError('File type not allowed', 400);
    }

    return true;
  }

  async saveFile(file, applicationId, userId) {
    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${userId}-${sanitizedFileName}`;
    
    const applicationDir = path.join(this.uploadPath, applicationId);
    await fs.mkdir(applicationDir, { recursive: true });
    
    const filePath = path.join(applicationDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    return {
      fileName: file.originalname,
      filePath: filePath,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }

  async getFileStream(filePath) {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new AppError('File not found', 404);
    }
  }
}

module.exports = new FileService();