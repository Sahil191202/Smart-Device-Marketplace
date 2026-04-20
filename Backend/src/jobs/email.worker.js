// src/jobs/email.worker.js
const nodemailer = require('nodemailer');
const { getQueue, QUEUE_NAMES } = require('./queue');
const {
  verifyEmailTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
  priceDropTemplate,
  orderShippedTemplate,
  sellerNewOrderTemplate,
} = require('./email.templates');
const logger = require('../config/logger');
const env = require('../config/env');

// ── SMTP transporter ──────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// ── Core send function ────────────────────────────────────────────────────────
const sendMail = async ({ to, subject, html }) => {
  const info = await transporter.sendMail({
    from: `SmartMarketplace <${env.EMAIL_FROM}>`,
    to,
    subject,
    html,
  });
  logger.info('Email sent', { to, subject, messageId: info.messageId });
  return info;
};

// ── All job handlers ──────────────────────────────────────────────────────────
const handlers = {

  // ── Auth emails ─────────────────────────────────────────────────────────────

  'email:verify': async (data) => {
    const { subject, html } = verifyEmailTemplate(data);
    await sendMail({ to: data.to, subject, html });
  },

  'email:passwordReset': async (data) => {
    const { subject, html } = passwordResetTemplate(data);
    await sendMail({ to: data.to, subject, html });
  },

  'email:passwordChanged': async (data) => {
    const { subject, html } = passwordChangedTemplate(data);
    await sendMail({ to: data.to, subject, html });
  },

  // ── Notification emails ──────────────────────────────────────────────────────
  // All notification emails come through 'email:notification'
  // We check the data shape to determine which template to use

  'email:notification': async (data) => {
    // Price drop alert
    if (data.productSlug && data.oldPrice && data.newPrice) {
      const { subject, html } = priceDropTemplate(data);
      await sendMail({ to: data.to, subject, html });
      return;
    }

    // Order shipped notification (to buyer)
    if (data.trackingNumber) {
      const { subject, html } = orderShippedTemplate(data);
      await sendMail({ to: data.to, subject, html });
      return;
    }

    // Seller new order notification
    if (data.productTitle && data.amount) {
      const { subject, html } = sellerNewOrderTemplate(data);
      await sendMail({ to: data.to, subject, html });
      return;
    }

    // Fallback generic notification
    logger.warn('email:notification — no matching template found', { data });
  },
};

// ── Start worker ──────────────────────────────────────────────────────────────
const startEmailWorker = () => {
  const emailQueue = getQueue(QUEUE_NAMES.EMAIL_QUEUE);

  emailQueue.process('*', 5, async (job) => {
    const handler = handlers[job.name];

    if (!handler) {
      logger.warn('Unknown email job type — skipping', { jobName: job.name });
      return; // don't throw — just skip unknown jobs
    }

    logger.debug('Processing email job', {
      jobId: job.id,
      jobName: job.name,
      to: job.data.to,
    });

    await handler(job.data);
  });

  // Log failed jobs
  emailQueue.on('failed', (job, err) => {
    logger.error('Email job failed', {
      jobId: job.id,
      jobName: job.name,
      to: job.data?.to,
      attempt: job.attemptsMade,
      error: err.message,
    });
  });

  logger.info('Email worker started', { concurrency: 5 });
};

module.exports = { startEmailWorker };