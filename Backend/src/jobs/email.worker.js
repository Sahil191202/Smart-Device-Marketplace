// src/jobs/email.worker.js
const nodemailer = require("nodemailer");
const { getQueue, QUEUE_NAMES } = require("./queue");
const {
  verifyEmailTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
} = require("./email.templates");
const logger = require("../config/logger");
const env = require("../config/env");

// ── SMTP transporter (reused across all jobs) ─────────────────────────────────
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for port 465, false for 587
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  pool: true, // reuse SMTP connections (important for high throughput)
  maxConnections: 5,
  maxMessages: 100,
});

const sendMail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `SmartMarketplace <${env.EMAIL_FROM}>`,
    to,
    subject,
    html,
  });
};

// ── Job handlers (map job name → handler function) ────────────────────────────
const handlers = {
  "email:verify": async (data) => {
    const { subject, html } = verifyEmailTemplate(data);
    await sendMail({ to: data.to, subject, html });
    logger.info("Verification email sent", { to: data.to });
  },

  "email:passwordReset": async (data) => {
    const { subject, html } = passwordResetTemplate(data);
    await sendMail({ to: data.to, subject, html });
    logger.info("Password reset email sent", { to: data.to });
  },

  "email:passwordChanged": async (data) => {
    const { subject, html } = passwordChangedTemplate(data);
    await sendMail({ to: data.to, subject, html });
    logger.info("Password changed email sent", { to: data.to });
  },
  "email:notification": async (data) => {
    const { priceDropTemplate } = require("./email.templates");
    if (data.type === "price_drop" || data.productSlug) {
      const { subject, html } = priceDropTemplate(data);
      await sendMail({ to: data.to, subject, html });
      logger.info("Price drop email sent", { to: data.to });
    }
  },
};

// ── Start worker ──────────────────────────────────────────────────────────────
const startEmailWorker = () => {
  const emailQueue = getQueue(QUEUE_NAMES.EMAIL_QUEUE);

  // concurrency: 5 = process 5 email jobs in parallel
  emailQueue.process("*", 5, async (job) => {
    const handler = handlers[job.name];

    if (!handler) {
      throw new Error(`Unknown email job type: ${job.name}`);
    }

    logger.debug("Processing email job", {
      jobId: job.id,
      jobName: job.name,
      to: job.data.to,
    });
    await handler(job.data);
  });

  logger.info("Email worker started", { concurrency: 5 });
};

module.exports = { startEmailWorker };
