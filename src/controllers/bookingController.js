const prisma = require('../config/database');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { generateBookingReference, generatePaymentReference } = require('../utils/helpers');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { BookingStatus, UserRole } = require('../utils/constants');

const createBooking = catchAsync(async (req, res) => {
  const {
    clientName,
    clientEmail,
    clientPhone,
    serviceId,
    scheduledStart,
    scheduledEnd,
    timezone,
    notes,
  } = req.body;

  // Check if user is logged in
  let clientId = null;
  if (req.user) {
    clientId = req.user.id;
  } else {
    // Check if email exists in system
    const existingUser = await prisma.user.findUnique({
      where: { email: clientEmail },
    });
    if (existingUser) {
      clientId = existingUser.id;
    }
  }

  const bookingReference = generateBookingReference();

  const booking = await prisma.booking.create({
    data: {
      bookingReference,
      clientId,
      clientName,
      clientEmail,
      clientPhone,
      serviceId,
      scheduledStart: new Date(scheduledStart),
      scheduledEnd: new Date(scheduledEnd),
      timezone,
      notes,
      bookingStatus: BookingStatus.PENDING,
    },
    include: {
      service: true,
    },
  });

  // Create payment record
  if (booking.service?.basePrice) {
    await prisma.payment.create({
      data: {
        paymentReference: generatePaymentReference(),
        bookingId: booking.id,
        userId: clientId,
        paymentType: 'CONSULTATION',
        amount: booking.service.basePrice,
        currency: booking.service.currency || 'USD',
        status: 'PENDING',
      },
    });
  }

  await authService.createActivityLog(
    clientId || 'system',
    'BOOKING_CREATED',
    'BOOKING',
    booking.id,
    null,
    booking,
    req
  );

  res.status(201).json({
    status: 'success',
    data: {
      booking,
    },
  });
});

const getMyBookings = catchAsync(async (req, res) => {
  const bookings = await prisma.booking.findMany({
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
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentReference: true,
        },
      },
    },
    orderBy: {
      scheduledStart: 'desc',
    },
  });

  res.json({
    status: 'success',
    results: bookings.length,
    data: {
      bookings,
    },
  });
});

const getAllBookings = catchAsync(async (req, res) => {
  const { status, fromDate, toDate, page = 1, limit = 10 } = req.query;
  
  const skip = (page - 1) * limit;
  
  const where = {};
  
  if (status) where.bookingStatus = status;
  if (fromDate || toDate) {
    where.scheduledStart = {};
    if (fromDate) where.scheduledStart.gte = new Date(fromDate);
    if (toDate) where.scheduledStart.lte = new Date(toDate);
  }

  const [bookings, totalCount] = await Promise.all([
    prisma.booking.findMany({
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
        service: {
          select: {
            id: true,
            name: true,
            basePrice: true,
          },
        },
        approvedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        payment: true,
      },
      orderBy: {
        scheduledStart: 'desc',
      },
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    status: 'success',
    results: bookings.length,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: parseInt(page),
    data: {
      bookings,
    },
  });
});

const getBooking = catchAsync(async (req, res) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
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
      service: {
        select: {
          id: true,
          name: true,
          description: true,
          basePrice: true,
        },
      },
      approvedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      payment: true,
    },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check access rights
  if (req.user.role === UserRole.CLIENT && booking.clientId !== req.user.id) {
    throw new AppError('You do not have permission to view this booking', 403);
  }

  res.json({
    status: 'success',
    data: {
      booking,
    },
  });
});

const approveBooking = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { meetingLink } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: true,
    },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (booking.bookingStatus !== BookingStatus.PENDING) {
    throw new AppError('Only pending bookings can be approved', 400);
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      bookingStatus: BookingStatus.APPROVED,
      approvedById: req.user.id,
      approvedAt: new Date(),
      meetingLink,
    },
    include: {
      client: true,
      service: true,
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'BOOKING_APPROVED',
    'BOOKING',
    id,
    { status: booking.bookingStatus },
    { status: BookingStatus.APPROVED },
    req
  );

  // Send confirmation email
  if (updatedBooking.client) {
    await emailService.sendBookingConfirmation(updatedBooking, updatedBooking.client);
  } else {
    // Send to guest email
    await emailService.sendBookingConfirmation(updatedBooking, { email: updatedBooking.clientEmail });
  }

  res.json({
    status: 'success',
    data: {
      booking: updatedBooking,
    },
  });
});

const rejectBooking = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (booking.bookingStatus !== BookingStatus.PENDING) {
    throw new AppError('Only pending bookings can be rejected', 400);
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      bookingStatus: BookingStatus.REJECTED,
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'BOOKING_REJECTED',
    'BOOKING',
    id,
    { status: booking.bookingStatus },
    { status: BookingStatus.REJECTED, reason },
    req
  );

  // TODO: Process refund if payment was made

  res.json({
    status: 'success',
    data: {
      booking: updatedBooking,
    },
  });
});

const completeBooking = catchAsync(async (req, res) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (booking.bookingStatus !== BookingStatus.APPROVED) {
    throw new AppError('Only approved bookings can be marked as completed', 400);
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      bookingStatus: BookingStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'BOOKING_COMPLETED',
    'BOOKING',
    id,
    { status: booking.bookingStatus },
    { status: BookingStatus.COMPLETED },
    req
  );

  res.json({
    status: 'success',
    data: {
      booking: updatedBooking,
    },
  });
});

const markNoShow = catchAsync(async (req, res) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (booking.bookingStatus !== BookingStatus.APPROVED) {
    throw new AppError('Only approved bookings can be marked as no-show', 400);
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      bookingStatus: BookingStatus.NO_SHOW,
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'BOOKING_NO_SHOW',
    'BOOKING',
    id,
    { status: booking.bookingStatus },
    { status: BookingStatus.NO_SHOW },
    req
  );

  res.json({
    status: 'success',
    data: {
      booking: updatedBooking,
    },
  });
});

module.exports = {
  createBooking,
  getMyBookings,
  getAllBookings,
  getBooking,
  approveBooking,
  rejectBooking,
  completeBooking,
  markNoShow,
};