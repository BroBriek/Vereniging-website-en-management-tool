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
  // Ionos Configuration
  if (process.env.IONOS_EMAIL && process.env.IONOS_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.IONOS_HOST || 'smtp.ionos.de',
      port: parseInt(process.env.IONOS_PORT || '587', 10),
      secure: process.env.IONOS_PORT === '465',
      auth: { user: process.env.IONOS_EMAIL, pass: process.env.IONOS_PASSWORD }
    });
  }
  if (process.env.GMAIL_EMAIL && process.env.GMAIL_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_PASSWORD }
    });
  }
  return null;
};

const sendMail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();
  const from = process.env.IONOS_EMAIL || process.env.GMAIL_EMAIL || process.env.MAILERSEND_FROM || 'no-reply@chirosite.local';
  if (!transporter) {
    console.log('SIMULATED EMAIL', { from, to, subject, text, html });
    return;
  }
  await transporter.sendMail({ from, to, subject, text, html });
};

module.exports = { sendMail };
