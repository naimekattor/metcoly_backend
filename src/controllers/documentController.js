const prisma = require('../config/database');
const fileService = require('../services/fileService');
const authService = require('../services/authService');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { UserRole, ApplicationStatusag } = require('../utils/constants');

const uploadDocument = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const { applicationId, documentType } = req.body;

  // Validate file
  fileService.validateFile(req.file);

  // Check if application exists and user has access
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  // Check access rights
  if (req.user.role === UserRole.CLIENT && application.clientId !== req.user.id) {
    throw new AppError('You can only upload documents to your own applications', 403);
  }

  if (req.user.role === UserRole.CONSULTANT && application.consultantId !== req.user.id) {
    throw new AppError('You can only upload documents to applications assigned to you', 403);
  }

  // Save file
  const fileInfo = await fileService.saveFile(req.file, applicationId, req.user.id);

  // Check if there's an existing document of same type to version
  const existingDocument = await prisma.document.findFirst({
    where: {
      applicationId,
      documentType,
      isCurrentVersion: true,
    },
  });

  let document;

  if (existingDocument) {
    // Mark old version as not current
    await prisma.document.update({
      where: { id: existingDocument.id },
      data: { isCurrentVersion: false },
    });

    // Create new version
    document = await prisma.document.create({
      data: {
        applicationId,
        uploadedById: req.user.id,
        fileName: fileInfo.fileName,
        filePath: fileInfo.filePath,
        fileSize: fileInfo.fileSize,
        mimeType: fileInfo.mimeType,
        documentType,
        isCurrentVersion: true,
        version: existingDocument.version + 1,
      },
    });

    // Create version history
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        fileName: fileInfo.fileName,
        filePath: fileInfo.filePath,
        fileSize: fileInfo.fileSize,
        version: existingDocument.version + 1,
        uploadedById: req.user.id,
        changeReason: `New version of ${documentType}`,
      },
    });
  } else {
    // First version
    document = await prisma.document.create({
      data: {
        applicationId,
        uploadedById: req.user.id,
        fileName: fileInfo.fileName,
        filePath: fileInfo.filePath,
        fileSize: fileInfo.fileSize,
        mimeType: fileInfo.mimeType,
        documentType,
        isCurrentVersion: true,
        version: 1,
      },
    });
  }

  // If application is in DOCUMENTS_MISSING status, update to SUBMITTED
  if (application.status === ApplicationStatus.DOCUMENTS_MISSING) {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.SUBMITTED,
        lastStatusChangeAt: new Date(),
      },
    });
  }

  await authService.createActivityLog(
    req.user.id,
    'DOCUMENT_UPLOADED',
    'DOCUMENT',
    document.id,
    null,
    { fileName: document.fileName, documentType },
    req
  );

  res.status(201).json({
    status: 'success',
    data: {
      document: {
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        version: document.version,
        uploadedAt: document.uploadedAt,
        fileSize: document.fileSize,
      },
    },
  });
});

const getApplicationDocuments = catchAsync(async (req, res) => {
  const { applicationId } = req.params;

  // Check if application exists and user has access
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  if (req.user.role === UserRole.CLIENT && application.clientId !== req.user.id) {
    throw new AppError('You can only view documents of your own applications', 403);
  }

  if (req.user.role === UserRole.CONSULTANT && application.consultantId !== req.user.id) {
    throw new AppError('You can only view documents of applications assigned to you', 403);
  }

  const documents = await prisma.document.findMany({
    where: {
      applicationId,
      isCurrentVersion: true,
    },
    include: {
      uploadedBy: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      versions: {
        orderBy: {
          version: 'desc',
        },
        take: 5,
      },
    },
    orderBy: {
      uploadedAt: 'desc',
    },
  });

  res.json({
    status: 'success',
    results: documents.length,
    data: {
      documents,
    },
  });
});

const downloadDocument = catchAsync(async (req, res) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      application: {
        select: {
          id: true,
          clientId: true,
          consultantId: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  // Check access rights
  if (req.user.role === UserRole.CLIENT && document.application.clientId !== req.user.id) {
    throw new AppError('You do not have permission to download this document', 403);
  }

  if (req.user.role === UserRole.CONSULTANT && document.application.consultantId !== req.user.id) {
    throw new AppError('You do not have permission to download this document', 403);
  }

  const fileContent = await fileService.getFileStream(document.filePath);

  await authService.createActivityLog(
    req.user.id,
    'DOCUMENT_DOWNLOADED',
    'DOCUMENT',
    id,
    null,
    { fileName: document.fileName },
    req
  );

  res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
  res.send(fileContent);
});

const deleteDocument = catchAsync(async (req, res) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      application: {
        select: {
          clientId: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  // Only client can delete their own documents
  if (req.user.role !== UserRole.SUPER_ADMIN) {
    if (req.user.role === UserRole.CLIENT && document.application.clientId !== req.user.id) {
      throw new AppError('You can only delete your own documents', 403);
    }
    if (req.user.role === UserRole.CONSULTANT) {
      throw new AppError('Consultants cannot delete documents', 403);
    }
  }

  // Soft delete - mark as not current instead of actually deleting
  await prisma.document.update({
    where: { id },
    data: {
      isCurrentVersion: false,
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'DOCUMENT_DELETED',
    'DOCUMENT',
    id,
    { fileName: document.fileName },
    null,
    req
  );

  res.json({
    status: 'success',
    message: 'Document deleted successfully',
  });
});

const getDocumentVersions = catchAsync(async (req, res) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({
    where: { id },
  });

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  const versions = await prisma.documentVersion.findMany({
    where: {
      documentId: id,
    },
    include: {
      uploadedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      version: 'desc',
    },
  });

  res.json({
    status: 'success',
    data: {
      versions,
    },
  });
});

module.exports = {
  uploadDocument,
  getApplicationDocuments,
  downloadDocument,
  deleteDocument,
  getDocumentVersions,
};