const prisma = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const authService = require('../services/authService');
const { generatePaymentReference } = require('../utils/helpers');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { PaymentStatus, PaymentType, ApplicationStatus } = require('../utils/constants');

const createPaymentSession = catchAsync(async (req, res) => {
  const { applicationId, bookingId, paymentType } = req.body;

  let amount, currency, metadata = {}, itemName;

  if (applicationId) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        service: true,
      },
    });

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    if (application.clientId !== req.user.id) {
      throw new AppError('You can only pay for your own applications', 403);
    }

    amount = application.service?.basePrice || 0;
    currency = application.service?.currency || 'USD';
    itemName = `Application Processing Fee - ${application.applicationNumber}`;
    metadata = {
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
      paymentType,
    };
  } else if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
      },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    amount = booking.service?.basePrice || 0;
    currency = booking.service?.currency || 'USD';
    itemName = `Consultation Fee - ${booking.bookingReference}`;
    metadata = {
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      paymentType,
    };
  } else {
    throw new AppError('Either applicationId or bookingId is required', 400);
  }

  // Create payment record
  const paymentReference = generatePaymentReference();
  
  const payment = await prisma.payment.create({
    data: {
      paymentReference,
      applicationId,
      bookingId,
      userId: req.user.id,
      paymentType,
      amount,
      currency,
      status: PaymentStatus.PENDING,
      metadata,
    },
  });

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: itemName,
            metadata,
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    client_reference_id: req.user.id,
    metadata: {
      paymentId: payment.id,
      paymentReference,
      ...metadata,
    },
  });

  // Update payment with Stripe session ID
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      stripeSessionId: session.id,
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'PAYMENT_SESSION_CREATED',
    'PAYMENT',
    payment.id,
    null,
    { sessionId: session.id },
    req
  );

  res.json({
    status: 'success',
    data: {
      sessionId: session.id,
      url: session.url,
      paymentReference,
    },
  });
});

const handleWebhook = catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    case 'checkout.session.expired':
      await handleCheckoutSessionExpired(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

const handleCheckoutSessionCompleted = async (session) => {
  const { paymentId, paymentReference, applicationId, bookingId } = session.metadata;

  // Update payment status
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.PAID,
      stripePaymentIntentId: session.payment_intent,
      paidAt: new Date(),
    },
    include: {
      application: {
        include: {
          client: true,
        },
      },
      booking: {
        include: {
          client: true,
        },
      },
    },
  });

  // If payment is for application, update application status if it's submitted
  if (applicationId && payment.application) {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });
  }

  await authService.createActivityLog(
    payment.userId,
    'PAYMENT_COMPLETED',
    'PAYMENT',
    paymentId,
    { status: PaymentStatus.PENDING },
    { status: PaymentStatus.PAID },
    null
  );

  console.log(`Payment completed: ${paymentReference}`);
};

const handleCheckoutSessionExpired = async (session) => {
  const { paymentId } = session.metadata;

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.FAILED,
    },
  });

  console.log(`Payment expired: ${paymentId}`);
};

const handlePaymentFailed = async (paymentIntent) => {
  // Find payment by payment intent ID
  const payment = await prisma.payment.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
      },
    });

    console.log(`Payment failed: ${payment.paymentReference}`);
  }
};

const getPaymentStatus = catchAsync(async (req, res) => {
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      application: {
        select: {
          id: true,
          applicationNumber: true,
          status: true,
        },
      },
      booking: {
        select: {
          id: true,
          bookingReference: true,
          bookingStatus: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  // Check access rights
  if (req.user.role === 'CLIENT' && payment.userId !== req.user.id) {
    throw new AppError('You can only view your own payments', 403);
  }

  res.json({
    status: 'success',
    data: {
      payment,
    },
  });
});

const getMyPayments = catchAsync(async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: {
      userId: req.user.id,
    },
    include: {
      application: {
        select: {
          id: true,
          applicationNumber: true,
        },
      },
      booking: {
        select: {
          id: true,
          bookingReference: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    status: 'success',
    results: payments.length,
    data: {
      payments,
    },
  });
});

const getAllPayments = catchAsync(async (req, res) => {
  const { status, paymentType, fromDate, toDate, page = 1, limit = 10 } = req.query;
  
  const skip = (page - 1) * limit;
  
  const where = {};
  
  if (status) where.status = status;
  if (paymentType) where.paymentType = paymentType;
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        application: {
          select: {
            id: true,
            applicationNumber: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingReference: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.payment.count({ where }),
  ]);

  res.json({
    status: 'success',
    results: payments.length,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: parseInt(page),
    data: {
      payments,
    },
  });
});

const refundPayment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;

  const payment = await prisma.payment.findUnique({
    where: { id },
  });

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.status !== PaymentStatus.PAID) {
    throw new AppError('Only paid payments can be refunded', 400);
  }

  if (!payment.stripePaymentIntentId) {
    throw new AppError('No Stripe payment intent found for this payment', 400);
  }

  // Process refund through Stripe
  const refundAmount = amount || payment.amount; // If amount not specified, refund full amount
  const refund = await stripe.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
    amount: Math.round(refundAmount * 100), // Convert to cents
    reason: 'requested_by_customer',
    metadata: {
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      reason,
    },
  });

  // Update payment status
  const updatedPayment = await prisma.payment.update({
    where: { id },
    data: {
      status: PaymentStatus.REFUNDED,
      refundedAt: new Date(),
      refundAmount: refundAmount,
      metadata: {
        ...payment.metadata,
        refundId: refund.id,
        refundReason: reason,
      },
    },
  });

  await authService.createActivityLog(
    req.user.id,
    'PAYMENT_REFUNDED',
    'PAYMENT',
    id,
    { status: PaymentStatus.PAID },
    { status: PaymentStatus.REFUNDED, amount: refundAmount },
    req
  );

  res.json({
    status: 'success',
    data: {
      payment: updatedPayment,
      refund: {
        id: refund.id,
        amount: refundAmount,
        status: refund.status,
      },
    },
  });
});

module.exports = {
  createPaymentSession,
  handleWebhook,
  getPaymentStatus,
  getMyPayments,
  getAllPayments,
  refundPayment,
};