// src/jobs/queue.js
const Bull = require('bull');
const { getBullRedisOptions } = require('../config/redis');
const logger = require('../config/logger');

const queues = new Map();

/**
 * Get or create a Bull queue by name.
 * All queues share the same Redis connection config.
 */
const getQueue = (name) => {
  if (queues.has(name)) return queues.get(name);

  const queue = new Bull(name, {
    ...getBullRedisOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s retry delays
      },
      removeOnComplete: { count: 100 }, // keep last 100 completed jobs for monitoring
      removeOnFail: { count: 200 },     // keep last 200 failed jobs for debugging
    },
  });

  // Global queue event listeners
  queue.on('error', (err) => {
    logger.error(`Queue [${name}] error`, { error: err.message });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Queue [${name}] job failed`, {
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade,
      error: err.message,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Queue [${name}] job stalled`, { jobId: job.id });
  });

  queues.set(name, queue);
  return queue;
};

// Named queues
const EMAIL_QUEUE = 'email';
const IMAGE_QUEUE = 'image-processing';
const AI_QUEUE = 'ai-prediction';
const NOTIFICATION_QUEUE = 'notification';

const addEmailJob = async (jobName, data, options = {}) => {
  const queue = getQueue(EMAIL_QUEUE);
  return queue.add(jobName, data, {
    priority: 1, // emails are high priority
    ...options,
  });
};

const addImageJob = async (jobName, data, options = {}) => {
  const queue = getQueue(IMAGE_QUEUE);
  return queue.add(jobName, data, options);
};

const addAIJob = async (jobName, data, options = {}) => {
  const queue = getQueue(AI_QUEUE);
  return queue.add(jobName, data, options);
};

const addNotificationJob = async (jobName, data, options = {}) => {
  const queue = getQueue(NOTIFICATION_QUEUE);
  return queue.add(jobName, data, options);
};

const closeAllQueues = async () => {
  const closePromises = Array.from(queues.values()).map(q => q.close());
  await Promise.all(closePromises);
  logger.info('All Bull queues closed');
};

module.exports = {
  getQueue,
  addEmailJob,
  addImageJob,
  addAIJob,
  addNotificationJob,
  closeAllQueues,
  QUEUE_NAMES: { EMAIL_QUEUE, IMAGE_QUEUE, AI_QUEUE, NOTIFICATION_QUEUE },
};