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

const sendMail = async ({ to, from: customFrom, ...mailOptions }) => {
  const transporter = createTransporter();
  const from = customFrom || process.env.IONOS_EMAIL || process.env.GMAIL_EMAIL || process.env.MAILERSEND_FROM || 'no-reply@chirosite.local';

  const baseUrl = (process.env.APP_URL || 'https://www.chiromeeuwen.be').replace(/\/+$/, '');
  const contactUrl = `${baseUrl}/contact`;

  const htmlDisclaimer = `
<div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777777; text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <p style="margin: 0 0 5px 0;">Dit is een automatische e-mail (no-reply). Gelieve niet rechtstreeks te antwoorden op dit bericht.</p>
  <p style="margin: 0;">Heb je vragen? Gebruik het <a href="${contactUrl}" style="color: #db3e41; text-decoration: underline;">contactformulier op de website</a>.</p>
</div>
`;

  const textDisclaimer = `\n\n---\nDit is een automatische e-mail (no-reply). Gelieve niet rechtstreeks te antwoorden op dit bericht.\nHeb je vragen? Gebruik het contactformulier op onze website: ${contactUrl}`;

  const formattedMailOptions = { ...mailOptions };

  if (formattedMailOptions.html) {
    if (formattedMailOptions.html.includes('</body>')) {
      formattedMailOptions.html = formattedMailOptions.html.replace('</body>', `${htmlDisclaimer}</body>`);
    } else {
      formattedMailOptions.html += htmlDisclaimer;
    }
  }

  if (formattedMailOptions.text) {
    formattedMailOptions.text += textDisclaimer;
  } else if (!formattedMailOptions.html) {
    formattedMailOptions.text = textDisclaimer.trim();
  }

  if (!transporter) {
    console.log('SIMULATED EMAIL', { from, to, ...formattedMailOptions });
    return;
  }
  await transporter.sendMail({ from, to, ...formattedMailOptions });
};

module.exports = { sendMail };
