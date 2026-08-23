const nodemailer = require('nodemailer');

const isPlaceholder = (val) => {
  if (!val) return true;
  const str = String(val).trim().toLowerCase();
  return (
    str.includes('example.com') ||
    str.startsWith('your_') ||
    str.startsWith('replace_') ||
    str === 'dummy' ||
    str === 'changeme'
  );
};

const createTransporter = () => {
  if (process.env.SIMULATE_EMAIL === 'true') {
    return null;
  }

  // Standard generic SMTP Configuration (Priority 1)
  const host = process.env.SMTP_HOST || process.env.IONOS_HOST || process.env.MAILERSEND_SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.IONOS_EMAIL || process.env.MAILERSEND_SMTP_USER || process.env.GMAIL_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.IONOS_PASSWORD || process.env.MAILERSEND_SMTP_PASS || process.env.MAILERSEND_API_KEY || process.env.GMAIL_PASSWORD;
  const port = parseInt(process.env.SMTP_PORT || process.env.IONOS_PORT || process.env.MAILERSEND_SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || process.env.IONOS_PORT === '465' || port === 465;

  if (host && user && pass && !isPlaceholder(host) && !isPlaceholder(user) && !isPlaceholder(pass)) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }

  // Mailersend API Key only
  if (process.env.MAILERSEND_API_KEY && !isPlaceholder(process.env.MAILERSEND_API_KEY)) {
    return nodemailer.createTransport({
      host: 'smtp.mailersend.net',
      port: 587,
      secure: false,
      auth: { user: 'apikey', pass: process.env.MAILERSEND_API_KEY }
    });
  }

  // Gmail service fallback
  if (process.env.GMAIL_EMAIL && process.env.GMAIL_PASSWORD && !isPlaceholder(process.env.GMAIL_EMAIL) && !isPlaceholder(process.env.GMAIL_PASSWORD)) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_PASSWORD }
    });
  }

  // Ionos direct fallback
  if (process.env.IONOS_EMAIL && process.env.IONOS_PASSWORD && !isPlaceholder(process.env.IONOS_EMAIL) && !isPlaceholder(process.env.IONOS_PASSWORD)) {
    return nodemailer.createTransport({
      host: process.env.IONOS_HOST || 'smtp.ionos.de',
      port: parseInt(process.env.IONOS_PORT || '587', 10),
      secure: process.env.IONOS_PORT === '465',
      auth: { user: process.env.IONOS_EMAIL, pass: process.env.IONOS_PASSWORD }
    });
  }

  return null;
};

const sendMail = async ({ to, from: customFrom, ...mailOptions }) => {
  const transporter = createTransporter();
  const orgName = process.env.ORG_NAME || process.env.ORGANIZATION_NAME || 'Chiro Vreugdeland';
  const defaultEmail = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.CONTACT_EMAIL || process.env.IONOS_EMAIL || process.env.GMAIL_EMAIL || process.env.MAILERSEND_FROM || 'no-reply@example.com';
  const from = customFrom || (defaultEmail.includes('<') ? defaultEmail : `"${orgName}" <${defaultEmail}>`);

  const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
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
  try {
    await transporter.sendMail({ from, to, ...formattedMailOptions });
  } catch (err) {
    if (err.code === 'EAUTH') {
      console.warn(`⚠️ [Mailer] SMTP Authentication failed (EAUTH): Ongeldige inloggegevens. Controleer SMTP_USER en SMTP_PASS in je .env bestand. (Email naar ${to} niet verstuurd)`);
      return;
    }
    throw err;
  }
};

module.exports = { sendMail };
