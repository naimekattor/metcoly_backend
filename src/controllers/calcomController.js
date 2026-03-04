// src/controllers/calcomController.js
const calcomService = require('../services/calcomService');
const prisma = require('../config/database');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { BookingStatus } = require('../utils/constants');

/**
 * Handle Cal.com webhook - PUBLIC ENDPOINT
 * Cal.com sends all booking events here
 */
const handleWebhook = catchAsync(async (req, res) => {
  // Get raw body for signature verification (captured in app.js)
  const rawBody = req.rawBody;
  const signature = req.headers['cal-signature'] || req.headers['x-cal-signature-256'];

  // Verify webhook signature
  if (process.env.CALCOM_WEBHOOK_SECRET) {
    if (!rawBody) {
      console.error('❌ Missing raw body');
      return res.status(401).json({ error: 'Missing request body' });
    }
    if (!signature) {
      console.error('❌ Missing signature header (cal-signature or x-cal-signature-256)');
      return res.status(401).json({ error: 'Missing security headers' });
    }

    const isValid = calcomService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // Parse the webhook payload
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { triggerEvent, payload, createdAt } = body;

  console.log(`\n📨 ===== CAL.COM WEBHOOK =====`);
  console.log(`Event: ${triggerEvent}`);
  console.log(`Booking UID: ${payload?.uid}`);
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Process based on event type
    switch (triggerEvent) {
      case 'BOOKING_CREATED':
        await handleBookingCreated(payload);
        break;
      case 'BOOKING_RESCHEDULED':
        await handleBookingRescheduled(payload);
        break;
      case 'BOOKING_CANCELLED':
        await handleBookingCancelled(payload);
        break;
      case 'BOOKING_PAID':
        await handleBookingPaid(payload);
        break;
      case 'MEETING_ENDED':
        await handleMeetingEnded(payload);
        break;
      case 'BOOKING_NO_SHOW_UPDATED':
        await handleNoShow(payload);
        break;
      default:
        console.log(`Unhandled event: ${triggerEvent}`);
    }

    // Log to activity_logs
    await prisma.activityLog.create({
      data: {
        actionType: `CALCOM_${triggerEvent}`,
        entityType: 'BOOKING',
        entityId: payload?.uid,
        newData: { event: triggerEvent, payload }
      }
    });

    console.log(`✅ Webhook processed successfully`);
    console.log(`🔚 ===== END WEBHOOK =====\n`);

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });

  } catch (error) {
    console.error(`❌ Error processing webhook:`, error);
    // Still return 200 to acknowledge receipt
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * Handle new booking from Cal.com
 */
async function handleBookingCreated(payload) {
  const { uid, title, startTime, endTime, attendees, location, metadata } = payload;

  console.log(`✅ Creating new booking: ${uid}`);

  const primaryAttendee = attendees?.[0] || {};

  // Check if user exists with this email
  const existingUser = await prisma.user.findUnique({
    where: { email: primaryAttendee.email }
  });

  // Create booking in your database using your existing model
  const booking = await prisma.booking.create({
    data: {
      bookingReference: uid, // Use Cal.com UID as reference
      clientId: existingUser?.id || null,
      clientEmail: primaryAttendee.email || '',
      clientName: primaryAttendee.name || title || 'Consultation',
      clientPhone: primaryAttendee.phone || null,
      scheduledStart: new Date(startTime),
      scheduledEnd: new Date(endTime),
      timezone: primaryAttendee.timeZone || 'UTC',
      meetingLink: location || null,
      notes: metadata?.notes || null,
      bookingStatus: BookingStatus.PENDING,
      // Store Cal.com metadata
      metadata: {
        calBookingUid: uid,
        eventTypeId: payload.eventTypeId,
        attendees: attendees,
        ...metadata
      }
    }
  });

  console.log(`✅ Booking stored with ID: ${booking.id}`);

  // If this booking is linked to an application
  if (metadata?.applicationId) {
    await prisma.application.update({
      where: { id: metadata.applicationId },
      data: {
        bookings: {
          connect: { id: booking.id }
        }
      }
    });
  }
}

/**
 * Handle booking rescheduled
 */
async function handleBookingRescheduled(payload) {
  const { uid, startTime, endTime, rescheduleReason } = payload;

  console.log(`🔄 Rescheduling booking: ${uid}`);

  const booking = await prisma.booking.update({
    where: { bookingReference: uid },
    data: {
      scheduledStart: new Date(startTime),
      scheduledEnd: new Date(endTime),
      notes: rescheduleReason ? `Rescheduled: ${rescheduleReason}` : undefined
    }
  });

  console.log(`✅ Booking rescheduled: ${booking.id}`);
}

/**
 * Handle booking cancelled
 */
async function handleBookingCancelled(payload) {
  const { uid, cancellationReason } = payload;

  console.log(`❌ Cancelling booking: ${uid}`);

  const booking = await prisma.booking.update({
    where: { bookingReference: uid },
    data: {
      bookingStatus: BookingStatus.REJECTED,
      cancelledAt: new Date(),
      cancellationReason: cancellationReason || 'Cancelled via Cal.com'
    }
  });

  console.log(`✅ Booking cancelled: ${booking.id}`);
}

/**
 * Handle booking paid - This will integrate with your payment flow
 */
async function handleBookingPaid(payload) {
  const { uid, payment } = payload;

  console.log(`💰 Payment received for booking: ${uid}`);

  // Update booking status
  const booking = await prisma.booking.update({
    where: { bookingReference: uid },
    data: {
      bookingStatus: BookingStatus.APPROVED,
      approvedAt: new Date()
    }
  });

  // Create payment record if you have payment model
  if (payment) {
    await prisma.payment.create({
      data: {
        paymentReference: `CAL-${payment.id}`,
        bookingId: booking.id,
        amount: payment.amount,
        currency: payment.currency || 'USD',
        status: 'PAID',
        paidAt: new Date(),
        metadata: payment
      }
    });
  }

  console.log(`✅ Booking approved after payment: ${booking.id}`);
}

/**
 * Handle meeting ended
 */
async function handleMeetingEnded(payload) {
  const { uid } = payload;

  console.log(`🏁 Meeting ended: ${uid}`);

  const booking = await prisma.booking.update({
    where: { bookingReference: uid },
    data: {
      bookingStatus: BookingStatus.COMPLETED,
      completedAt: new Date()
    }
  });

  console.log(`✅ Booking completed: ${booking.id}`);
}

/**
 * Handle no-show
 */
async function handleNoShow(payload) {
  const { uid } = payload;

  console.log(`🚫 No-show for booking: ${uid}`);

  const booking = await prisma.booking.update({
    where: { bookingReference: uid },
    data: {
      bookingStatus: BookingStatus.NO_SHOW
    }
  });

  console.log(`✅ Booking marked as no-show: ${booking.id}`);
}

/**
 * Public booking lookup (for frontend "track your booking")
 */
const getPublicBooking = catchAsync(async (req, res) => {
  const { bookingReference } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { bookingReference },
    select: {
      bookingReference: true,
      clientName: true,
      clientEmail: true,
      scheduledStart: true,
      scheduledEnd: true,
      bookingStatus: true,
      meetingLink: true,
      timezone: true
    }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Only return safe public data
  res.json({
    status: 'success',
    data: {
      reference: booking.bookingReference,
      clientName: booking.clientName,
      date: booking.scheduledStart,
      timezone: booking.timezone,
      status: booking.bookingStatus,
      meetingLink: booking.bookingStatus === 'APPROVED' ? booking.meetingLink : null
    }
  });
});

module.exports = {
  handleWebhook,
  getPublicBooking
};