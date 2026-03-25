const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Immigration Platform';
    const html = `
      <h1>Welcome ${user.firstName}!</h1>
      <p>Thank you for joining our immigration consultation platform.</p>
      <p>You can now <a href="${process.env.FRONTEND_URL}/login">login</a> to your account.</p>
    `;

    return await this.sendEmail(user.email, subject, html);
  }

  // Generic mail sender helper
  async sendEmail(to, subject, html, shouldThrow = false) {
    console.log(`📨 Preparing to send email to: ${to} | Subject: ${subject}`);
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Immigration Platform" <noreply@immigration.com>',
      to,
      subject,
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✨ Email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('🔥 Error sending email:', error.message);
      if (shouldThrow) throw error;
      return null; // Return null instead of throwing to prevent API crashes
    }
  }

  // In your email service
  async sendTemporaryPasswordEmail(email, tempPassword, firstName, role) {
    console.log(`📬 Constructing temporary password email for ${firstName} (${email})`);
    const subject = 'Your Account Has Been Created';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to the Team!</h2>
      <p>Hello ${firstName},</p>
      <p>Your account has been created as a <strong>${role}</strong>.</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #444;">Your Login Credentials</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> <code style="background: #e0e0e0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
      </div>
      
      <p><a href="${process.env.FRONTEND_URL}/login" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Login to Your Account</a></p>
      
      <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #495057;">
          <strong>💡 Tip:</strong> You can change this password anytime from your profile settings.
        </p>
      </div>
      
      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        For security reasons, never share your password with anyone.
      </p>
    </div>
  `;

    await this.sendEmail(email, subject, html);
  }

  async sendBookingConfirmation(booking, user) {
    const subject = 'Booking Confirmation';
    const html = `
      <h1>Booking Confirmed!</h1>
      <p>Your consultation has been booked for:</p>
      <p><strong>Date:</strong> ${new Date(booking.scheduledStart).toLocaleString()}</p>
      <p><strong>Duration:</strong> ${(new Date(booking.scheduledEnd) - new Date(booking.scheduledStart)) / 60000} minutes</p>
      ${booking.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a></p>` : ''}
    `;

    return await this.sendEmail(user?.email || booking.clientEmail, subject, html);
  }

  async sendApplicationStatusUpdate(application, user) {
    const subject = 'Application Status Update';
    const html = `
      <h1>Application #${application.applicationNumber}</h1>
      <p>Your application status has been updated to: <strong>${application.status}</strong></p>
      <p>Login to your account to view more details.</p>
    `;

    return await this.sendEmail(user.email, subject, html);
  }
}

module.exports = new EmailService();