// src/shared/utils/metrics.js
const os = require('os');
const { getRedisClient } = require('../../config/redis');
const { getQueue, QUEUE_NAMES } = require('../../jobs/queue');
const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * Collect system + application metrics.
 * Called by GET /metrics (admin only) and GET /health (public).
 */
const collectMetrics = async () => {
  const [queueMetrics, redisInfo] = await Promise.all([
    getQueueMetrics(),
    getRedisInfo(),
  ]);

  // Memory
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // CPU load average (1, 5, 15 min)
  const [load1, load5, load15] = os.loadavg();

  return {
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
    },
    memory: {
      process: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),   // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024),             // MB
        external: Math.round(memUsage.external / 1024 / 1024),   // MB
      },
      system: {
        total: Math.round(totalMem / 1024 / 1024),   // MB
        free: Math.round(freeMem / 1024 / 1024),     // MB
        used: Math.round((totalMem - freeMem) / 1024 / 1024), // MB
        usedPct: ((1 - freeMem / totalMem) * 100).toFixed(1),
      },
    },
    cpu: {
      load1: load1.toFixed(2),
      load5: load5.toFixed(2),
      load15: load15.toFixed(2),
      cores: os.cpus().length,
    },
    database: {
      mongodb: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        poolSize: mongoose.connection.pool?.size || 0,
      },
    },
    redis: redisInfo,
    queues: queueMetrics,
    timestamp: new Date().toISOString(),
  };
};

const getQueueMetrics = async () => {
  const queueNames = Object.values(QUEUE_NAMES);
  const metrics = {};

  await Promise.allSettled(
    queueNames.map(async (name) => {
      try {
        const queue = getQueue(name);
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);
        metrics[name] = { waiting, active, completed, failed, delayed };
      } catch (err) {
        metrics[name] = { error: err.message };
      }
    })
  );

  return metrics;
};

const getRedisInfo = async () => {
  try {
    const redis = getRedisClient();
    const info = await redis.info('memory');

    // Parse Redis INFO string into object
    const lines = info.split('\r\n');
    const parsed = {};
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) parsed[key.trim()] = value.trim();
      }
    }

    return {
      status: 'connected',
      usedMemoryMb: Math.round(
        parseInt(parsed.used_memory || 0) / 1024 / 1024
      ),
      maxMemoryMb: Math.round(
        parseInt(parsed.maxmemory || 0) / 1024 / 1024
      ),
      memFragmentationRatio: parsed.mem_fragmentation_ratio,
      connectedClients: parsed.connected_clients,
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
};

module.exports = { collectMetrics };