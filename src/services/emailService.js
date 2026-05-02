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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0F2A4D;">Welcome ${user.firstName}!</h1>
        <p>Thank you for joining our immigration consultation platform.</p>
        <p>You can now log in to your account to start your immigration journey.</p>
        <div style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/login" style="background-color: #0F2A4D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Login Now</a>
        </div>
      </div>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  // Generic mail sender helper
  async sendEmail(to, subject, html) {
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
      console.error('🔥 Error sending email:', error);
      throw error;
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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0F2A4D;">Booking Confirmed!</h1>
        <p>Your consultation has been booked for:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Date:</strong> ${new Date(booking.scheduledStart).toLocaleString()}</p>
          <p><strong>Duration:</strong> ${(new Date(booking.scheduledEnd) - new Date(booking.scheduledStart)) / 60000} minutes</p>
          ${booking.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a></p>` : ''}
        </div>
      </div>
    `;

    await this.sendEmail(user?.email || booking.clientEmail, subject, html);
  }

  async sendApplicationStatusUpdate(application, user) {
    const subject = `Application Update: #${application.applicationNumber}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0F2A4D;">Application Status Update</h2>
        <p>Hello ${user.firstName},</p>
        <p>The status of your application <strong>#${application.applicationNumber}</strong> has been updated.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #666;">New Status:</p>
          <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #0F2A4D;">${application.status.replace('_', ' ')}</p>
        </div>
        
        <p>You can view the full details of your application by logging into your dashboard.</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.FRONTEND_URL}/dashboard/user/my-cases/${application.id}" style="background-color: #0F2A4D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">View Application</a>
        </div>
        
        <p style="color: #666; font-size: 12px; border-top: 1px solid #eee; pt: 20px; margin-top: 30px;">
          This is an automated notification. Please do not reply directly to this email.
        </p>
      </div>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  async sendPasswordResetEmail(user, resetUrl) {
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${user.firstName},</p>
        <p>You requested a password reset. Please click the button below to set a new password. This link is valid for 1 hour.</p>
        
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #1b3d6e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
        </div>
        
        <p>If you did not request this, please ignore this email.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #495057; font-size: 12px;">
            If the button above doesn't work, copy and paste this URL into your browser: <br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
        </div>
      </div>
    `;

    await this.sendEmail(user.email, subject, html);
  }
}

module.exports = new EmailService();
