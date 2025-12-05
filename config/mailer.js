const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.MAILERSEND_SMTP_USER && (process.env.MAILERSEND_SMTP_PASS || process.env.MAILERSEND_API_KEY)) {
    return nodemailer.createTransport({
      host: process.env.MAILERSEND_SMTP_HOST || 'smtp.mailersend.net',
      port: parseInt(process.env.MAILERSEND_SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.MAILERSEND_SMTP_USER, pass: process.env.MAILERSEND_SMTP_PASS || process.env.MAILERSEND_API_KEY }
    });
  }
  if (process.env.MAILERSEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.mailersend.net',
      port: 587,
      secure: false,
      auth: { user: 'apikey', pass: process.env.MAILERSEND_API_KEY }
    });
  }
  if (process.env.EMAIL_PASSWORD) {
    return nodemailer.createTransport({
      service: 'outlook',
      auth: { user: 'Chiromeeuwen@outlook.com', pass: process.env.EMAIL_PASSWORD }
    });
  }
  return null;
};

const sendMail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();
  const from = process.env.MAILERSEND_FROM || 'no-reply@chirosite.local';
  if (!transporter) {
    console.log('SIMULATED EMAIL', { from, to, subject, text, html });
    return;
  }
  await transporter.sendMail({ from, to, subject, text, html });
};

module.exports = { sendMail };
