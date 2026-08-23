const fs = require('fs');
const { exec } = require('child_process');
const { User } = require('../models');
const { sendMail } = require('../config/mailer');

let lastEmailSentTime = 0;
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

const getAdminEmail = async () => {
  try {
    const admin = await User.findOne({ where: { username: 'admin' } });
    if (admin && admin.email) return admin.email;
  } catch (error) {
    console.error('Error finding admin user:', error);
  }
  return process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_USER || process.env.IONOS_EMAIL || process.env.GMAIL_EMAIL || process.env.MAILERSEND_FROM || null;
};

const formatError = (error, context = '') => {
  let message;
  if (typeof error === 'string') {
    message = error;
  } else if (error && error.stack) {
    message = error.stack;
  } else {
    try {
      message = JSON.stringify(error, null, 2);
    } catch (stringifyError) {
      message = String(error);
    }
  }
  return `${context ? `${context}\n\n` : ''}${message}`;
};

const sendErrorNotification = async (errorLog) => {
  const now = Date.now();
  if (now - lastEmailSentTime < RATE_LIMIT_MS) {
    console.log('Error notification suppressed due to rate limiting.');
    return;
  }

  const adminEmail = await getAdminEmail();
  if (!adminEmail) {
    console.log('No admin email configured. Cannot send notification.');
    return;
  }

  try {
    await sendMail({
      to: adminEmail,
      subject: '⚠️ Foutmelding in de applicatie ⚠️',
      text: `Er is een fout gedetecteerd in de applicatie:\n\n${errorLog}\n\n(Dit is een automatisch bericht. Je ontvangt de komende 5 minuten geen nieuwe meldingen.)`,
      html: `
        <h3>⚠️ Foutmelding in de applicatie ⚠️</h3>
        <p>Er is een fout gedetecteerd in de applicatie:</p>
        <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto;">${errorLog}</pre>
        <p><small>(Dit is een automatisch bericht. Je ontvangt de komende 5 minuten geen nieuwe meldingen.)</small></p>
      `
    });
    console.log(`Error notification sent to ${adminEmail}`);
    lastEmailSentTime = now;
  } catch (err) {
    console.error('Failed to send error notification:', err);
  }
};

const watchFile = (filePath) => {
  console.log(`Starting monitoring for PM2 error log: ${filePath}`);
  
  let currentSize = 0;
  try {
      if (fs.existsSync(filePath)) {
          currentSize = fs.statSync(filePath).size;
      }
  } catch (e) {
      // File might not exist yet or permission error
  }

  // Use fs.watchFile for cross-platform simplicity and polling to avoid some inotify issues
  fs.watchFile(filePath, { interval: 2000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
        // File changed
        const newSize = curr.size;
        if (newSize > prev.size) {
            // Content added
            const stream = fs.createReadStream(filePath, {
                start: prev.size,
                end: newSize
            });
            let newData = '';
            stream.on('data', chunk => newData += chunk);
            stream.on('end', () => {
                if (newData.trim()) {
                    sendErrorNotification(newData.trim());
                }
            });
        } else if (newSize < prev.size) {
            // File truncated (logs cleared)
            console.log(`Log file ${filePath} was truncated.`);
        }
    }
  });
};

const handleProcessError = async (error, context) => {
  console.error(context, error);
  await sendErrorNotification(formatError(error, context));
};

const init = () => {
  process.on('uncaughtException', (err) => {
    handleProcessError(err, 'Uncaught Exception');
  });

  process.on('unhandledRejection', (reason) => {
    handleProcessError(reason, 'Unhandled Rejection');
  });

  exec('pm2 jlist', (err, stdout, stderr) => {
    if (err) {
      console.log('PM2 not detected or failed to list processes. PM2 log monitoring skipped.');
      return;
    }

    try {
      const processes = JSON.parse(stdout);
      const watchedPaths = new Set();

      processes.forEach(proc => {
        if (proc.pm2_env && proc.pm2_env.pm_err_log_path) {
          const logPath = proc.pm2_env.pm_err_log_path;
          if (!watchedPaths.has(logPath) && fs.existsSync(logPath)) {
            watchedPaths.add(logPath);
            watchFile(logPath);
          }
        }
      });
      
      if (watchedPaths.size === 0) {
        console.log('No accessible PM2 error logs found to monitor.');
      }
    } catch (parseError) {
      console.error('Failed to parse PM2 output for monitoring:', parseError);
    }
  });
};

const notifyError = async (error, context = 'Application Error') => {
  await sendErrorNotification(formatError(error, context));
};

module.exports = { init, notifyError };
