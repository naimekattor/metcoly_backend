const prisma = require('../config/database');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { generateApplicationNumber } = require('../utils/helpers');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { ApplicationStatus, UserRole } = require('../utils/constants');

const createApplication = catchAsync(async (req, res) => {
  const { serviceId, country, formData } = req.body;

  const applicationNumber = generateApplicationNumber();

  const application = await prisma.application.create({
    data: {
      applicationNumber,
      clientId: req.user.id,
      serviceId,
      country,
      formData: formData || {},
      status: ApplicationStatus.DRAFT,
    },
    include: {
      client: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'APPLICATION_CREATED',
    'APPLICATION',
    application.id,
    null,
    application,
    req
  );

  res.status(201).json({
    status: 'success',
    data: {
      application,
    },
  });
});

const getMyApplications = catchAsync(async (req, res) => {
  const applications = await prisma.application.findMany({
    where: {
      clientId: req.user.id,
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
        },
      },
      consultant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      documents: {
        where: {
          isCurrentVersion: true,
        },
        select: {
          id: true,
          fileName: true,
          documentType: true,
          uploadedAt: true,
          version: true,
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentType: true,
          createdAt: true,
        },
      },
      statusHistory: {
        orderBy: {
          changedAt: 'desc',
        },
        take: 5,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    status: 'success',
    results: applications.length,
    data: {
      applications,
    },
  });
});

const getConsultantApplications = catchAsync(async (req, res) => {
  const applications = await prisma.application.findMany({
    where: {
      consultantId: req.user.id,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
      documents: {
        where: {
          isCurrentVersion: true,
        },
        select: {
          id: true,
          fileName: true,
          documentType: true,
          uploadedAt: true,
        },
      },
      notes: {
        where: {
          noteType: 'CLIENT_VISIBLE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  res.json({
    status: 'success',
    results: applications.length,
    data: {
      applications,
    },
  });
});

const getAllApplications = catchAsync(async (req, res) => {
  const { status, consultantId, fromDate, toDate, page = 1, limit = 10 } = req.query;

  const skip = (page - 1) * limit;

  const where = {};

  if (status) where.status = status;
  if (consultantId) where.consultantId = consultantId;
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [applications, totalCount] = await Promise.all([
    prisma.application.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        consultant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            documents: true,
            payments: true,
            notes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.application.count({ where }),
  ]);

  res.json({
    status: 'success',
    results: applications.length,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: parseInt(page),
    data: {
      applications,
    },
  });
});

const getApplication = catchAsync(async (req, res) => {
  const { id } = req.params;

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      consultant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          description: true,
          basePrice: true,
        },
      },
      documents: {
        where: {
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
        },
        orderBy: {
          uploadedAt: 'desc',
        },
      },
      notes: {
        include: {
          consultant: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      payments: {
        select: {
          id: true,
          paymentReference: true,
          amount: true,
          currency: true,
          status: true,
          paymentType: true,
          paidAt: true,
          createdAt: true,
        },
      },
      statusHistory: {
        include: {
          changedBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: {
          changedAt: 'desc',
        },
      },
      consultantAssignments: {
        where: {
          isCurrent: true,
        },
        include: {
          consultant: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assignedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  // Check access rights
  if (req.user.role === UserRole.CLIENT && application.clientId !== req.user.id) {
    throw new AppError('You do not have permission to view this application', 403);
  }

  if (req.user.role === UserRole.CONSULTANT && application.consultantId !== req.user.id) {
    throw new AppError('You do not have permission to view this application', 403);
  }

  res.json({
    status: 'success',
    data: {
      application,
    },
  });
});

const submitApplication = catchAsync(async (req, res) => {
  const { id } = req.params;

  const application = await prisma.application.findUnique({
    where: { id },
  });

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  if (application.clientId !== req.user.id) {
    throw new AppError('You can only submit your own applications', 403);
  }

  if (application.status !== ApplicationStatus.DRAFT) {
    throw new AppError('Only draft applications can be submitted', 400);
  }

  const updatedApplication = await prisma.application.update({
    where: { id },
    data: {
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
    },
    include: {
      client: true,
    },
  });

  await prisma.applicationStatusHistory.create({
    data: {
      applicationId: id,
      oldStatus: application.status,
      newStatus: ApplicationStatus.SUBMITTED,
      changedById: req.user.id,
      reason: 'Initial application submission',
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'APPLICATION_SUBMITTED',
    'APPLICATION',
    id,
    { status: application.status },
    { status: ApplicationStatus.SUBMITTED },
    req
  );

  // Notify admins (you can implement this later)
  // await emailService.notifyAdminsNewApplication(updatedApplication);

  res.json({
    status: 'success',
    data: {
      application: updatedApplication,
    },
  });
});

const updateApplicationStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      client: true,
    },
  });

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  // Check if consultant has access
  if (req.user.role === UserRole.CONSULTANT && application.consultantId !== req.user.id) {
    throw new AppError('You can only update applications assigned to you', 403);
  }

  // Validate status transition
  const validTransitions = {
    [ApplicationStatus.SUBMITTED]: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.DOCUMENTS_MISSING],
    [ApplicationStatus.UNDER_REVIEW]: [ApplicationStatus.PROCESSING, ApplicationStatus.DOCUMENTS_MISSING],
    [ApplicationStatus.DOCUMENTS_MISSING]: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW],
    [ApplicationStatus.PROCESSING]: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED],
  };

  if (req.user.role !== UserRole.SUPER_ADMIN) {
    const allowedTransitions = validTransitions[application.status] || [];
    if (!allowedTransitions.includes(status)) {
      throw new AppError(`Cannot transition from ${application.status} to ${status}`, 400);
    }
  }

  const updatedApplication = await prisma.application.update({
    where: { id },
    data: {
      status,
      lastStatusChangeAt: new Date(),
    },
    include: {
      client: true,
      consultant: true,
    },
  });

  await prisma.applicationStatusHistory.create({
    data: {
      applicationId: id,
      oldStatus: application.status,
      newStatus: status,
      changedById: req.user.id,
      reason,
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'APPLICATION_STATUS_UPDATED',
    'APPLICATION',
    id,
    { status: application.status },
    { status },
    req
  );

  // Notify client
  try {
    if (updatedApplication.client && updatedApplication.client.email) {
      await emailService.sendApplicationStatusUpdate(updatedApplication, updatedApplication.client);
    }
  } catch (emailError) {
    console.error('Failed to send status update email:', emailError);
    // Don't throw error here, as the status update in DB was successful
  }

  res.json({
    status: 'success',
    data: {
      application: updatedApplication,
    },
  });
});

const assignConsultant = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { consultantId } = req.body;

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      consultantAssignments: {
        where: {
          isCurrent: true,
        },
      },
    },
  });

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  const consultant = await prisma.user.findUnique({
    where: { id: consultantId },
  });

  if (!consultant || consultant.role !== UserRole.CONSULTANT) {
    throw new AppError('Invalid consultant ID', 400);
  }

  // Update current assignment to not current
  if (application.consultantAssignments.length > 0) {
    await prisma.consultantAssignment.updateMany({
      where: {
        applicationId: id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        unassignedAt: new Date(),
        unassignedById: req.user.id,
      },
    });
  }

  // Create new assignment
  const assignment = await prisma.consultantAssignment.create({
    data: {
      applicationId: id,
      consultantId,
      assignedById: req.user.id,
      isCurrent: true,
    },
    include: {
      consultant: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Update application with new consultant
  const updatedApplication = await prisma.application.update({
    where: { id },
    data: {
      consultantId,
      assignedById: req.user.id,
      assignedAt: new Date(),
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'CONSULTANT_ASSIGNED',
    'APPLICATION',
    id,
    { oldConsultantId: application.consultantId },
    { newConsultantId: consultantId },
    req
  );

  res.json({
    status: 'success',
    data: {
      assignment,
      application: updatedApplication,
    },
  });
});

const addConsultantNote = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { noteType, content } = req.body;

  const application = await prisma.application.findUnique({
    where: { id },
  });

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  // Check if consultant has access
  if (req.user.role === UserRole.CONSULTANT && application.consultantId !== req.user.id) {
    throw new AppError('You can only add notes to applications assigned to you', 403);
  }

  const note = await prisma.consultantNote.create({
    data: {
      applicationId: id,
      consultantId: req.user.id,
      noteType,
      content,
    },
    include: {
      consultant: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'NOTE_ADDED',
    'APPLICATION',
    id,
    null,
    { noteId: note.id, noteType },
    req
  );

  res.status(201).json({
    status: 'success',
    data: {
      note,
    },
  });
});

const updateApplication = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { formData, country } = req.body;

  const application = await prisma.application.findUnique({
    where: { id },
  });

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  // Only client can update their draft application
  if (application.clientId !== req.user.id) {
    throw new AppError('You can only update your own applications', 403);
  }

  if (application.status !== ApplicationStatus.DRAFT && application.status !== ApplicationStatus.DOCUMENTS_MISSING) {
    throw new AppError('Application cannot be updated in current status', 400);
  }

  const updatedApplication = await prisma.application.update({
    where: { id },
    data: {
      formData: formData ? { ...application.formData, ...formData } : application.formData,
      country: country || application.country,
    },
  });

  res.json({
    status: 'success',
    data: {
      application: updatedApplication,
    },
  });
});

module.exports = {
  createApplication,
  getMyApplications,
  getConsultantApplications,
  getAllApplications,
  getApplication,
  submitApplication,
  updateApplicationStatus,
  assignConsultant,
  addConsultantNote,
  updateApplication,
};