const axios = require('axios');
const crypto = require('crypto');

class CalComService {
  constructor() {
    this.apiKey = process.env.CALCOM_API_KEY;
    this.baseUrl = process.env.CALCOM_BASE_URL || 'https://api.cal.com/v1';
    this.webhookSecret = process.env.CALCOM_WEBHOOK_SECRET;
  }

  /**
   * Get authentication headers for API requests
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  /**
   * Verify webhook signature for security
   * @param {string} payload - The RAW request body string
   * @param {string} signature - The signature from cal-signature header
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) return true;

    // NOTE: payload must be the EXACT RAW STRING from the request body captured in app.js
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = hmac.update(payload).digest('hex');

    return signature === digest;
  }

  /**
   * Get all event types
   */
  async getEventTypes() {
    try {
      const response = await axios.get(`${this.baseUrl}/event-types`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching event types:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get a specific event type by ID
   */
  async getEventType(eventTypeId) {
    try {
      const response = await axios.get(`${this.baseUrl}/event-types/${eventTypeId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching event type:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get booking details by UID
   */
  async getBooking(bookingUid) {
    try {
      const response = await axios.get(`${this.baseUrl}/bookings/${bookingUid}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching booking:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a booking (useful for manual bookings)
   */
  async createBooking(bookingData) {
    try {
      const response = await axios.post(`${this.baseUrl}/bookings`, bookingData, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error creating booking:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingUid, reason = '') {
    try {
      const response = await axios.delete(`${this.baseUrl}/bookings/${bookingUid}`, {
        headers: this.getHeaders(),
        data: { reason }
      });
      return response.data;
    } catch (error) {
      console.error('Error cancelling booking:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update a booking
   */
  async updateBooking(bookingUid, updateData) {
    try {
      const response = await axios.patch(`${this.baseUrl}/bookings/${bookingUid}`, updateData, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error updating booking:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get available slots for an event type
   */
  async getAvailableSlots(eventTypeId, startDate, endDate, timezone) {
    try {
      const response = await axios.get(`${this.baseUrl}/slots`, {
        headers: this.getHeaders(),
        params: {
          eventTypeId,
          startTime: startDate,
          endTime: endDate,
          timeZone: timezone
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching slots:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Process webhook payload based on event type
   */
  async processWebhook(eventType, payload) {
    console.log(`📥 Processing Cal.com webhook: ${eventType}`);

    switch (eventType) {
      case 'BOOKING_CREATED':
        return await this.handleBookingCreated(payload);
      case 'BOOKING_RESCHEDULED':
        return await this.handleBookingRescheduled(payload);
      case 'BOOKING_CANCELLED':
        return await this.handleBookingCancelled(payload);
      case 'BOOKING_PAID':
        return await this.handleBookingPaid(payload);
      case 'MEETING_ENDED':
        return await this.handleMeetingEnded(payload);
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
        return { received: true, eventType };
    }
  }

  /**
   * Handle booking created event
   */
  async handleBookingCreated(payload) {
    const { uid, title, startTime, endTime, attendees, eventTypeId, metadata } = payload;

    console.log(`✅ New booking created: ${uid}`);

    // 🔜 YOU WILL ADD:
    // 1. Check if user exists in your database
    const existingUser = await prisma.user.findUnique({
      where: { email: attendees[0]?.email }
    });

    // 2. Create booking in your database
    const booking = await prisma.booking.create({
      data: {
        bookingReference: uid,
        clientId: existingUser?.id,
        clientEmail: attendees[0]?.email,
        clientName: attendees[0]?.name,
        scheduledStart: new Date(startTime),
        scheduledEnd: new Date(endTime),
        timezone: attendees[0]?.timeZone,
        bookingStatus: 'PENDING'
      }
    });

    return {
      received: true,
      bookingUid: uid,
      bookingId: booking.id
    };
  }

  /**
   * Handle booking rescheduled event
   */
  async handleBookingRescheduled(payload) {
    const { uid, startTime, endTime, rescheduleReason } = payload;

    console.log(`🔄 Booking rescheduled: ${uid}`);
    console.log(`   New time: ${new Date(startTime).toLocaleString()}`);
    console.log(`   Reason: ${rescheduleReason || 'Not provided'}`);

    // Update booking in your database

    return {
      received: true,
      bookingUid: uid,
      action: 'booking_rescheduled'
    };
  }

  /**
   * Handle booking cancelled event
   */
  async handleBookingCancelled(payload) {
    const { uid, cancellationReason } = payload;

    console.log(`❌ Booking cancelled: ${uid}`);
    console.log(`   Reason: ${cancellationReason || 'Not provided'}`);

    // Update booking status in your database

    return {
      received: true,
      bookingUid: uid,
      action: 'booking_cancelled'
    };
  }

  /**
   * Handle booking paid event (if using Cal.com payments)
   */
  async handleBookingPaid(payload) {
    const { uid, payment } = payload;

    console.log(`💰 Booking paid: ${uid}`);
    console.log(`   Amount: ${payment.amount} ${payment.currency}`);

    // Mark booking as paid in your database
    // Trigger post-payment workflows

    return {
      received: true,
      bookingUid: uid,
      action: 'booking_paid'
    };
  }

  /**
   * Handle meeting ended event
   */
  async handleMeetingEnded(payload) {
    const { uid } = payload;

    console.log(`🏁 Meeting ended: ${uid}`);

    // Mark meeting as completed
    // Send follow-up emails, etc.

    return {
      received: true,
      bookingUid: uid,
      action: 'meeting_ended'
    };
  }
}

module.exports = new CalComService();